// ============================
// 服务器入口
// ============================

import express from "express";

import { createServer } from "http";
import { Server } from "socket.io";

import roomRoutes from "./routes/room.routes.js";
import qqMusicRoutes from "./routes/qqmusic.routes.js";
import { registerSocketHandlers } from "./socket/room.handler.js";
import { logInfo, logError } from "./logger.js";

const TAG = "Server";
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: { origin: "*" },
});

app.use(express.json());

// ----- 注册路由 -----
app.use("/api/rooms", roomRoutes);
app.use("/api/qqmusic", qqMusicRoutes);

// ----- 注册 Socket 处理器 -----
registerSocketHandlers(io);

// ----- 启动服务 -----
async function startServer() {
    const isProduction = process.env.NODE_ENV === "production";

    if (!isProduction) {
        const { createServer: createViteServer } = await import("vite");
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: "spa",
        });
        app.use(vite.middlewares);
        logInfo(TAG, "Vite 开发服务器中间件已挂载");
    } else {
        app.use(express.static("dist"));
        logInfo(TAG, "已挂载静态资源目录 dist，运行为生产模式");
    }

    const PORT = Number(process.env.PORT) || 3000;
    httpServer.listen(PORT, "0.0.0.0", () => {
        logInfo(TAG, `服务器启动成功`, {
            port: PORT,
            mode: isProduction ? "production" : "development",
            url: `http://localhost:${PORT}`,
        });
    });
}

// --- 全局错误处理，防止部分老旧 npm 包（如 qq-music-api 内部未 catch 被拒绝的 promise）导致服务崩溃 ---
process.on('uncaughtException', (err) => {
    logError(TAG, "Uncaught Exception", err);
});

process.on('unhandledRejection', (reason, promise) => {
    logError(TAG, "Unhandled Rejection", reason);
});

startServer().catch(err => {
    console.error("服务启动失败:", err);
    process.exit(1);
});
