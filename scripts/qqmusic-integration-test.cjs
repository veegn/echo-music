const { spawn } = require('child_process');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const storageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'echo-music-qq-it-'));
const persistCookie = 'uin=o012345; qqmusic_key=test-key; qm_keyst=test-key;';
const realisticCookie = [
  'eas_sid=31z7Z6w9b7w8s187G3F5f1B8I8',
  'pgv_pvid=4212045504',
  'qq_domain_video_guid_verify=310ea30b0dc2c4b5',
  '_qimei_uuid42=1a11f0e04021001d4808767eff4084ae9747dbfae5',
  '_qimei_fingerprint=9e8e88ad5498e92053a42edd91e790a2',
  'login_type=1',
  'tmeLoginType=2',
  'psrf_musickey_createtime=1773667919',
  'qqmusic_key=Q_H_L_63k3NfVd3WHfhdwOP3msjO1KRvPoLrJGXybl7EZ3t4O7sqdSK5brRsDbTy6laKm6OSXgxgpmbXyp1TaiKLzcSTYeJ',
  'euin=7K-q7w-zNe4A',
  'uin=529620852',
  'qm_keyst=Q_H_L_63k3NfVd3WHfhdwOP3msjO1KRvPoLrJGXybl7EZ3t4O7sqdSK5brRsDbTy6laKm6OSXgxgpmbXyp1TaiKLzcSTYeJ',
  'psrf_qqaccess_token=5A42278F7C480A32063013200D725DE4',
  'psrf_qqunionid=3CFC7A3B1E266B48EA3E9009A2B7A594',
  'music_ignore_pskey=202306271436Hn@vBj',
  'psrf_qqrefresh_token=4CBEB066546994326BC67E8B93BAD71B',
  'psrf_qqopenid=53148005B3088D7B5CD954B5BB0D857F',
  'psrf_access_token_expiresAt=1778851919',
].join('; ');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findAvailablePort(startPort = 3200) {
  const initialPort = process.env.PORT
    ? Number(process.env.PORT)
    : startPort + Math.floor(Math.random() * 20000);

  for (let port = initialPort; port < initialPort + 200; port += 1) {
    const isFree = await new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => server.close(() => resolve(true)));
      server.listen(port, '127.0.0.1');
    });

    if (isFree) return port;
  }

  throw new Error('Could not find an available port for qqmusic integration tests');
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

async function requestJson(baseUrl, pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: response.status, body };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function firstArray(...candidates) {
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

function pickSongMid(song) {
  return (
    song?.songmid ||
    song?.mid ||
    song?.songInfo?.mid ||
    song?.songInfo?.songMid ||
    song?.song_mid ||
    ''
  );
}

async function main() {
  const port = process.env.PORT ? Number(process.env.PORT) : await findAvailablePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const serverOut = fs.openSync(path.join(repoRoot, 'qqmusic-integration-test.out.log'), 'w');
  const serverErr = fs.openSync(path.join(repoRoot, 'qqmusic-integration-test.err.log'), 'w');
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

    const emptyCookie = await requestJson(baseUrl, '/api/qqmusic/verify-cookie', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert(emptyCookie.status === 200, 'verify-cookie without cookie should return 200');
    assert(emptyCookie.body.success === false, 'verify-cookie without cookie should fail');

    const validCookie = await requestJson(baseUrl, '/api/qqmusic/verify-cookie', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cookie: 'uin=o012345; qqmusic_key=test-key; qm_keyst=test-key;' }),
    });
    assert(validCookie.status === 200, 'verify-cookie with auth cookie should return 200');
    assert(validCookie.body.success === true, 'verify-cookie with auth cookie should succeed');

    const realisticVerify = await requestJson(baseUrl, '/api/qqmusic/verify-cookie', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cookie: realisticCookie }),
    });
    assert(realisticVerify.status === 200, 'verify-cookie with realistic cookie should return 200');
    assert(realisticVerify.body.success === true, 'verify-cookie with realistic cookie should succeed');

    const missingUinCookie = await requestJson(baseUrl, '/api/qqmusic/verify-cookie', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cookie: 'qqmusic_key=test-key; qm_keyst=test-key;' }),
    });
    assert(missingUinCookie.status === 200, 'verify-cookie without uin should return 200');
    assert(missingUinCookie.body.success === false, 'verify-cookie without uin should fail');
    assert(missingUinCookie.body.message === 'Cookie missing uin', 'verify-cookie without uin should expose missing uin reason');

    const missingAuthCookie = await requestJson(baseUrl, '/api/qqmusic/verify-cookie', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cookie: 'uin=529620852; ptcz=only-ptcz; RK=only-rk;' }),
    });
    assert(missingAuthCookie.status === 200, 'verify-cookie without auth key should return 200');
    assert(missingAuthCookie.body.success === false, 'verify-cookie without auth key should fail');
    assert(missingAuthCookie.body.message === 'Cookie missing auth key', 'verify-cookie without auth key should expose missing auth key reason');

    const searchMissing = await requestJson(baseUrl, '/api/qqmusic/search');
    assert(searchMissing.status === 400, 'search without key should return 400');

    const songUrlMissing = await requestJson(baseUrl, '/api/qqmusic/song/url');
    assert(songUrlMissing.status === 400, 'song/url without id should return 400');

    const userSonglistMissing = await requestJson(baseUrl, '/api/qqmusic/user/songlist');
    assert(userSonglistMissing.status === 400, 'user/songlist without id should return 400');

    const lyricMissing = await requestJson(baseUrl, '/api/qqmusic/lyric');
    assert(lyricMissing.status === 400, 'lyric without songmid should return 400');

    const songlistMissing = await requestJson(baseUrl, '/api/qqmusic/songlist');
    assert(songlistMissing.status === 400, 'songlist without id should return 400');

    const radioSongsMissing = await requestJson(baseUrl, '/api/qqmusic/radio/songs');
    assert(radioSongsMissing.status === 400, 'radio/songs without id should return 400');

    const qrStatusMissing = await requestJson(baseUrl, '/api/qqmusic/qrcode/status');
    assert(qrStatusMissing.status === 400, 'qrcode/status without qrsig should return 400');

    const room = await requestJson(baseUrl, '/api/rooms', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'QQMusic Test Room', hostName: 'Alice', password: '' }),
    });
    assert(room.status === 200, 'room creation should succeed');
    const roomId = room.body.id;

    const userSonglistNoCookie = await requestJson(baseUrl, `/api/qqmusic/user/songlist?id=123&roomId=${roomId}`);
    assert(userSonglistNoCookie.status === 400, 'user/songlist without room cookie should return 400');

    const roomCookieMissingUin = await requestJson(baseUrl, '/api/qqmusic/room-cookie', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ roomId, cookie: 'qqmusic_key=test-key; qm_keyst=test-key;' }),
    });
    assert(roomCookieMissingUin.status === 400, 'room-cookie without uin should return 400');
    assert(roomCookieMissingUin.body.success === false, 'room-cookie without uin should fail');
    assert(roomCookieMissingUin.body.message === 'Cookie missing uin', 'room-cookie without uin should expose missing uin reason');

    const realisticRoomCookie = await requestJson(baseUrl, '/api/qqmusic/room-cookie', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ roomId, cookie: realisticCookie }),
    });
    assert(realisticRoomCookie.status === 200, 'room-cookie with realistic cookie should return 200');
    assert(realisticRoomCookie.body.success === true, 'room-cookie with realistic cookie should succeed');
    assert(realisticRoomCookie.body.room.hasCookie === true, 'room-cookie should mark room as having cookie');
    assert(realisticRoomCookie.body.room.hostQQId === '529620852', 'room-cookie should normalize hostQQId from realistic cookie');
    assert(typeof realisticRoomCookie.body.room.hostCookie === 'undefined', 'room-cookie should not leak hostCookie in safe room state');

    const { io } = require('socket.io-client');
    const socket = io(baseUrl, { transports: ['websocket'] });
    await new Promise((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
    });
    socket.emit('join_room', { roomId, userName: 'Alice' });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout waiting for room join')), 5000);
      socket.on('room_state', (state) => {
        if (state.id === roomId && state.users.some((user) => user.name === 'Alice')) {
          clearTimeout(timer);
          resolve();
        }
      });
    });
    socket.emit('add_song', {
      songmid: 'persist-test-song',
      songname: 'Persist Test Song',
      singer: [{ name: 'Tester' }],
      album: { mid: 'persist-album' },
      albumname: 'Persist Album',
    });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout waiting for seeded current song')), 5000);
      socket.on('room_state', (state) => {
        if (state.id === roomId && state.currentSong?.songmid === 'persist-test-song') {
          clearTimeout(timer);
          resolve();
        }
      });
    });
    socket.emit('set_cookie', persistCookie);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout waiting for cookie persistence')), 5000);
      socket.on('room_state', (state) => {
        if (state.id === roomId && state.hasCookie === true && state.hostQQId === '12345') {
          clearTimeout(timer);
          resolve();
        }
      });
    });
    socket.disconnect();

    const roomsFile = path.join(storageDir, 'rooms.json');
    const persistedRooms = JSON.parse(fs.readFileSync(roomsFile, 'utf8'));
    assert(typeof persistedRooms[roomId].hostCookie === 'string', 'room cookie should persist to storage');
    assert(persistedRooms[roomId].hostCookie.includes('uin=12345'), 'persisted room cookie should normalize uin');
    assert(persistedRooms[roomId].hostCookie.includes('qqmusic_key=test-key'), 'persisted room cookie should retain qqmusic_key');
    assert(persistedRooms[roomId].hostCookie.includes('qm_keyst=test-key'), 'persisted room cookie should retain qm_keyst');
    assert(persistedRooms[roomId].hostQQId === '12345', 'room hostQQId should persist to storage');

    const fakeRoomId = 'does-not-exist';
    const userSonglistMissingRoom = await requestJson(baseUrl, `/api/qqmusic/user/songlist?id=123&roomId=${fakeRoomId}`);
    assert(userSonglistMissingRoom.status === 404, 'user/songlist with unknown room should return 404');

    const recommendMissingRoom = await requestJson(baseUrl, `/api/qqmusic/recommend/playlist/u?roomId=${fakeRoomId}`);
    assert(recommendMissingRoom.status === 404, 'recommend playlist with unknown room should return 404');

    const songlistMissingRoom = await requestJson(baseUrl, `/api/qqmusic/songlist?id=123&roomId=${fakeRoomId}`);
    assert(songlistMissingRoom.status === 404, 'songlist with unknown room should return 404');

    const liveResults = { enabled: process.env.QQMUSIC_LIVE === '1', checks: [] };
    if (process.env.QQMUSIC_LIVE === '1') {
      const hot = await requestJson(baseUrl, '/api/qqmusic/hot');
      assert(hot.status === 200, 'hot search should return 200 in live mode');
      liveResults.checks.push({ endpoint: '/api/qqmusic/hot', status: hot.status, hasBody: !!hot.body });

      const search = await requestJson(baseUrl, '/api/qqmusic/search?key=Jay&pageNo=1&pageSize=3');
      assert(search.status === 200, 'search should return 200 in live mode');
      liveResults.checks.push({ endpoint: '/api/qqmusic/search', status: search.status, hasData: !!search.body?.data });
    }

    const realCookie = process.env.QQMUSIC_REAL_COOKIE;
    const realUin = process.env.QQMUSIC_REAL_UIN;
    const smokeResults = { enabled: !!(realCookie && realUin), checks: [] };
    if (realCookie && realUin) {
      const realVerify = await requestJson(baseUrl, '/api/qqmusic/verify-cookie', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cookie: realCookie }),
      });
      assert(realVerify.status === 200, 'real verify-cookie should return 200');
      assert(realVerify.body.success === true, 'real verify-cookie should succeed');

      const { io } = require('socket.io-client');
      const smokeRoom = await requestJson(baseUrl, '/api/rooms', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'QQMusic Smoke Room', hostName: 'SmokeHost', password: '' }),
      });
      assert(smokeRoom.status === 200, 'smoke room creation should succeed');
      const smokeRoomId = smokeRoom.body.id;

      const realRoomCookie = await requestJson(baseUrl, '/api/qqmusic/room-cookie', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ roomId: smokeRoomId, cookie: realCookie }),
      });
      assert(realRoomCookie.status === 200, 'real room-cookie should return 200');
      assert(realRoomCookie.body.success === true, 'real room-cookie should succeed');
      assert(realRoomCookie.body.room.hostQQId === realUin, 'real room-cookie should preserve real uin');

      const smokeSocket = io(baseUrl, { transports: ['websocket'] });
      await new Promise((resolve, reject) => {
        smokeSocket.once('connect', resolve);
        smokeSocket.once('connect_error', reject);
      });
      smokeSocket.emit('join_room', { roomId: smokeRoomId, userName: 'SmokeHost' });
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout waiting for smoke room join')), 5000);
        smokeSocket.on('room_state', (state) => {
          if (state.id === smokeRoomId && state.users.some((user) => user.name === 'SmokeHost')) {
            clearTimeout(timer);
            resolve();
          }
        });
      });
      smokeSocket.emit('add_song', {
        songmid: 'smoke-seed-song',
        songname: 'Smoke Seed Song',
        singer: [{ name: 'Smoke Tester' }],
      });
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout waiting for smoke seed song')), 5000);
        smokeSocket.on('room_state', (state) => {
          if (state.id === smokeRoomId && state.currentSong?.songmid === 'smoke-seed-song') {
            clearTimeout(timer);
            resolve();
          }
        });
      });
      smokeSocket.emit('set_cookie', realCookie);
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout waiting for smoke cookie persistence')), 5000);
        smokeSocket.on('room_state', (state) => {
          if (state.id === smokeRoomId && state.hasCookie === true && state.hostQQId === realUin) {
            clearTimeout(timer);
            resolve();
          }
        });
      });

      const smokePlaylists = await requestJson(baseUrl, `/api/qqmusic/user/songlist?id=${encodeURIComponent(realUin)}&roomId=${smokeRoomId}`);
      assert(smokePlaylists.status === 200, 'smoke user/songlist should return 200');
      const smokePlaylistList = firstArray(
        smokePlaylists.body?.list,
        smokePlaylists.body?.data?.list,
        smokePlaylists.body?.data?.data?.playlists
      );
      assert(smokePlaylistList.length > 0, 'smoke user/songlist should return at least one playlist');

      const smokeHot = await requestJson(baseUrl, '/api/qqmusic/hot');
      assert(smokeHot.status === 200, 'smoke hot should return 200');

      const smokeSearch = await requestJson(baseUrl, '/api/qqmusic/search?key=周杰伦&pageNo=1&pageSize=3');
      assert(smokeSearch.status === 200, 'smoke search should return 200');

      const smokeRadioCategories = await requestJson(baseUrl, '/api/qqmusic/radio/categories');
      assert(smokeRadioCategories.status === 200, 'smoke radio/categories should return 200');

      const smokeRecommend = await requestJson(baseUrl, `/api/qqmusic/recommend/playlist/u?roomId=${smokeRoomId}`);
      assert(smokeRecommend.status === 200, 'smoke recommend/playlist/u should return 200');
      const smokeRecommendList = firstArray(
        smokeRecommend.body?.list,
        smokeRecommend.body?.data?.list,
        smokeRecommend.body?.data?.response?.data?.playlists,
        smokeRecommend.body?.data?.data?.playlists,
        smokeRecommend.body?.response?.data?.playlists
      );

      const firstPlaylist = smokePlaylistList[0];
      const smokeSonglist = await requestJson(baseUrl, `/api/qqmusic/songlist?id=${encodeURIComponent(firstPlaylist.dissid)}&roomId=${smokeRoomId}`);
      assert(smokeSonglist.status === 200, 'smoke songlist should return 200');
      const smokeSongs = firstArray(
        smokeSonglist.body?.cdlist?.[0]?.songlist,
        smokeSonglist.body?.data?.cdlist?.[0]?.songlist,
        smokeSonglist.body?.data?.data?.cdlist?.[0]?.songlist,
        smokeSonglist.body?.songlist,
        smokeSonglist.body?.data?.songlist
      );
      assert(smokeSongs.length > 0, 'smoke songlist should return songs');
      const smokeSongMid = pickSongMid(smokeSongs[0]);
      assert(smokeSongMid, 'smoke songlist should provide a songmid');

      const smokeSongUrl = await requestJson(baseUrl, `/api/qqmusic/song/url?id=${encodeURIComponent(smokeSongMid)}&roomId=${smokeRoomId}`);
      assert(smokeSongUrl.status === 200, 'smoke song/url should return 200');

      const smokeLyric = await requestJson(baseUrl, `/api/qqmusic/lyric?songmid=${encodeURIComponent(smokeSongMid)}`);
      assert(smokeLyric.status === 200, 'smoke lyric should return 200');

      const smokeRadio = await requestJson(baseUrl, `/api/qqmusic/radio/songs?id=99&roomId=${smokeRoomId}`);
      assert(smokeRadio.status === 200, 'smoke radio/songs should return 200');
      const smokeRadioTracks = firstArray(
        smokeRadio.body?.tracks,
        smokeRadio.body?.data?.tracks,
        smokeRadio.body?.data?.new_song?.data?.songlist,
        smokeRadio.body?.songlist,
        smokeRadio.body?.data?.songlist
      );
      const smokeRadioStations = firstArray(
        smokeRadio.body?.stations,
        smokeRadio.body?.data?.stations,
        smokeRadio.body?.data?.data?.data?.groupList?.flatMap((group) => group?.radioList || []),
        smokeRadio.body?.data?.data?.groupList?.flatMap((group) => group?.radioList || []),
        smokeRadio.body?.data?.groupList?.flatMap((group) => group?.radioList || [])
      );
      assert(
        smokeRadioTracks.length > 0 || smokeRadioStations.length > 0,
        'smoke radio/songs should return either personalized tracks or radio stations'
      );

      smokeResults.checks.push({
        endpoint: '/api/qqmusic/verify-cookie',
        status: realVerify.status,
        success: realVerify.body.success,
      });
      smokeResults.checks.push({
        endpoint: '/api/qqmusic/room-cookie',
        status: realRoomCookie.status,
        hostQQId: realRoomCookie.body.room.hostQQId,
      });
      smokeResults.checks.push({
        endpoint: '/api/qqmusic/user/songlist',
        status: smokePlaylists.status,
        playlists: smokePlaylistList.length,
      });
      smokeResults.checks.push({
        endpoint: '/api/qqmusic/hot',
        status: smokeHot.status,
      });
      smokeResults.checks.push({
        endpoint: '/api/qqmusic/search',
        status: smokeSearch.status,
        hasData: !!smokeSearch.body?.data,
      });
      smokeResults.checks.push({
        endpoint: '/api/qqmusic/radio/categories',
        status: smokeRadioCategories.status,
        hasData: !!smokeRadioCategories.body?.data,
      });
      smokeResults.checks.push({
        endpoint: '/api/qqmusic/recommend/playlist/u',
        status: smokeRecommend.status,
        playlists: smokeRecommendList.length,
        code: smokeRecommend.body?.code ?? smokeRecommend.body?.data?.code ?? null,
      });
      smokeResults.checks.push({
        endpoint: '/api/qqmusic/songlist',
        status: smokeSonglist.status,
        songs: smokeSongs.length,
      });
      smokeResults.checks.push({
        endpoint: '/api/qqmusic/song/url',
        status: smokeSongUrl.status,
        hasData: !!smokeSongUrl.body?.data,
      });
      smokeResults.checks.push({
        endpoint: '/api/qqmusic/lyric',
        status: smokeLyric.status,
        hasLyric: typeof smokeLyric.body?.lyric === 'string' || typeof smokeLyric.body?.data?.lyric === 'string',
      });
      smokeResults.checks.push({
        endpoint: '/api/qqmusic/radio/songs?id=99',
        status: smokeRadio.status,
        tracks: smokeRadioTracks.length,
        stations: smokeRadioStations.length,
      });
      smokeSocket.disconnect();
    }

    console.log(JSON.stringify({
      local: {
        verifyCookieEmpty: emptyCookie.body,
        verifyCookieValid: validCookie.body,
        verifyCookieRealistic: realisticVerify.body,
        verifyCookieMissingUin: missingUinCookie.body,
        verifyCookieMissingAuth: missingAuthCookie.body,
        searchMissingStatus: searchMissing.status,
        songUrlMissingStatus: songUrlMissing.status,
        userSonglistMissingStatus: userSonglistMissing.status,
        lyricMissingStatus: lyricMissing.status,
        songlistMissingStatus: songlistMissing.status,
        radioSongsMissingStatus: radioSongsMissing.status,
        qrStatusMissingStatus: qrStatusMissing.status,
        userSonglistNoCookieStatus: userSonglistNoCookie.status,
        roomCookieMissingUinStatus: roomCookieMissingUin.status,
        roomCookieRealisticStatus: realisticRoomCookie.status,
        cookiePersisted: true,
        userSonglistMissingRoomStatus: userSonglistMissingRoom.status,
        recommendMissingRoomStatus: recommendMissingRoom.status,
        songlistMissingRoomStatus: songlistMissingRoom.status,
        roomCreated: roomId,
      },
      live: liveResults,
      smoke: smokeResults,
    }, null, 2));
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
