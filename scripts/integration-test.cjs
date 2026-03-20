const { spawn } = require('child_process');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const { io } = require('socket.io-client');

const repoRoot = path.resolve(__dirname, '..');
const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'echo-music-it-'));

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findAvailablePort(startPort = 3100) {
  for (let port = startPort; port < startPort + 100; port += 1) {
    const isFree = await new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => {
        server.close(() => resolve(true));
      });
      server.listen(port, '127.0.0.1');
    });

    if (isFree) return port;
  }

  throw new Error('Could not find an available port for integration tests');
}

async function waitForServer(baseUrl, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/api/rooms`);
      if (response.ok) return;
    } catch {
    }
    await sleep(500);
  }
  throw new Error(`Server did not start within ${timeoutMs}ms`);
}

async function postJson(baseUrl, pathname, body) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: response.status, body: json };
}

async function getJson(baseUrl, pathname) {
  const response = await fetch(`${baseUrl}${pathname}`);
  return response.json();
}

function waitFor(socket, event, predicate = () => true, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timeout waiting for ${event}`));
    }, timeoutMs);

    const handler = (payload) => {
      try {
        if (!predicate(payload)) return;
        clearTimeout(timer);
        socket.off(event, handler);
        resolve(payload);
      } catch (error) {
        clearTimeout(timer);
        socket.off(event, handler);
        reject(error);
      }
    };

    socket.on(event, handler);
  });
}

async function ensureConnected(socket) {
  if (socket.connected) return;
  await new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
}

async function main() {
  const port = process.env.PORT ? Number(process.env.PORT) : await findAvailablePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const serverOut = fs.openSync(path.join(repoRoot, 'integration-test.out.log'), 'a');
  const serverErr = fs.openSync(path.join(repoRoot, 'integration-test.err.log'), 'a');
  const server = spawn('npm.cmd', ['run', 'start'], {
    cwd: repoRoot,
    shell: true,
    stdio: ['ignore', serverOut, serverErr],
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: 'production',
      ECHO_MUSIC_STORAGE_DIR: storageDir,
    },
  });

  try {
    await waitForServer(baseUrl);

    const openRoom = await postJson(baseUrl, '/api/rooms', {
      name: 'Integration Room',
      password: '',
      hostName: 'Alice',
    });
    const protectedRoom = await postJson(baseUrl, '/api/rooms', {
      name: 'Protected Integration Room',
      password: '1234',
      hostName: 'Alice',
    });
    const roomId = protectedRoom.body.id;

    const verifyWrong = await postJson(baseUrl, `/api/rooms/${roomId}/verify`, { password: 'bad' });
    const verifyOk = await postJson(baseUrl, `/api/rooms/${roomId}/verify`, { password: '1234' });

    const alice = io(baseUrl, { transports: ['websocket'] });
    await ensureConnected(alice);
    const aliceStatePromise = waitFor(
      alice,
      'room_state',
      (state) => state.id === roomId && state.users.some((user) => user.name === 'Alice')
    );
    alice.emit('join_room', { roomId, userName: 'Alice', password: '1234' });
    const aliceState = await aliceStatePromise;

    const bob = io(baseUrl, { transports: ['websocket'] });
    await ensureConnected(bob);
    const bobStatePromise = waitFor(
      bob,
      'room_state',
      (state) => state.id === roomId && state.users.some((user) => user.name === 'Bob') && state.users.length === 2
    );
    bob.emit('join_room', { roomId, userName: 'Bob', password: '1234' });
    const bobState = await bobStatePromise;

    const chatPromise = waitFor(
      bob,
      'chat_message',
      (message) => message.type === 'user' && message.userName === 'Alice' && message.text === 'hello room'
    );
    alice.emit('chat_message', 'hello room');
    const chatMessage = await chatPromise;

    const playPromise = waitFor(
      bob,
      'room_state',
      (state) => state.id === roomId && state.currentSong && state.currentSong.songname === 'Song A'
    );
    alice.emit('add_song', {
      songmid: 'mid-a',
      songname: 'Song A',
      singer: [{ name: 'Singer A' }],
      album: { mid: 'alb-a' },
      albumname: 'Album A',
    });
    const playState = await playPromise;

    const syncPromise = waitFor(
      bob,
      'player_sync',
      (payload) => payload.currentTime === 42 && payload.isPlaying === false
    );
    alice.emit('sync_player', { currentTime: 42, isPlaying: false });
    const syncPayload = await syncPromise;

    const skipPromise = waitFor(
      bob,
      'room_state',
      (state) => state.id === roomId && state.currentSong === null && state.queue.length === 0 && state.isPlaying === false
    );
    alice.emit('skip_song', false);
    const afterSkipState = await skipPromise;

    const leavePromise = waitFor(
      alice,
      'room_state',
      (state) => state.id === roomId && state.users.length === 1 && state.users[0].name === 'Alice'
    );
    bob.disconnect();
    const afterLeaveState = await leavePromise;
    alice.disconnect();

    await sleep(200);

    const rooms = await getJson(baseUrl, '/api/rooms');
    const openRoomSnapshot = rooms.find((room) => room.id === openRoom.body.id);
    const protectedRoomSnapshot = rooms.find((room) => room.id === roomId);

    console.log(
      JSON.stringify(
        {
          rest: {
            createOpenStatus: openRoom.status,
            createProtectedStatus: protectedRoom.status,
            verifyWrongStatus: verifyWrong.status,
            verifyOkStatus: verifyOk.status,
            openRoomListed: !!openRoomSnapshot,
            openRoomHasPassword: openRoomSnapshot?.hasPassword ?? null,
          },
          socket: {
            aliceUsers: aliceState.users.map((user) => user.name),
            bobUsers: bobState.users.map((user) => user.name),
            chatDelivered: chatMessage.text,
            currentSong: playState.currentSong.songname,
            currentSinger: playState.currentSong.singer,
            syncPayload,
            afterSkip: {
              currentSong: afterSkipState.currentSong,
              queueLength: afterSkipState.queue.length,
              isPlaying: afterSkipState.isPlaying,
            },
            afterLeaveUsers: afterLeaveState.users.map((user) => user.name),
          },
          rooms: {
            protectedRoomListed: !!protectedRoomSnapshot,
            protectedRoomUsersCount: protectedRoomSnapshot?.usersCount ?? null,
            protectedRoomHasPassword: protectedRoomSnapshot?.hasPassword ?? null,
          },
        },
        null,
        2
      )
    );
  } finally {
    server.kill('SIGTERM');
    await sleep(1500);
    if (!server.killed) server.kill('SIGKILL');
    fs.rmSync(storageDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});