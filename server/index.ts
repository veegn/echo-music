// ============================
// 服务器入口
// ============================

import express from "express";
import { createServer as createViteServer } from "vite";
import { createServer } from "http";
import { Server } from "socket.io";

import roomRoutes from "./routes/room.routes.js";
import qqMusicRoutes from "./routes/qqmusic.routes.js";
import { registerSocketHandlers } from "./socket/room.handler.js";
import { logInfo } from "./logger.js";

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
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: "spa",
        });
        app.use(vite.middlewares);
        logInfo(TAG, "Vite 开发服务器中间件已挂载");
    } else {
        app.use(express.static("dist"));
        logInfo(TAG, "已挂载静态资源目录 dist");
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

startServer().catch(err => {
    console.error("服务启动失败:", err);
    process.exit(1);
});
