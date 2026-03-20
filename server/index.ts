import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

import { logError, logInfo } from "./logger.js";
import createQQMusicRouter from "./routes/qqmusic.routes.js";
import roomRoutes from "./routes/room.routes.js";
import { registerSocketHandlers } from "./socket/room.handler.js";

const TAG = "Server";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: { origin: "*" },
});

app.use(express.json());
app.use("/api/rooms", roomRoutes);
app.use("/api/qqmusic", createQQMusicRouter(io));

registerSocketHandlers(io);

async function startServer(): Promise<void> {
    const isProduction = process.env.NODE_ENV === "production";

    if (!isProduction) {
        const { createServer: createViteServer } = await import("vite");
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: "spa",
        });
        app.use(vite.middlewares);
        logInfo(TAG, "Mounted Vite middleware for development mode");
    } else {
        app.use(express.static("dist"));
        logInfo(TAG, "Serving static files from dist in production mode");
    }

    const port = Number(process.env.PORT) || 3000;
    httpServer.listen(port, "0.0.0.0", () => {
        logInfo(TAG, "Server started", {
            port,
            mode: isProduction ? "production" : "development",
            url: `http://localhost:${port}`,
        });
    });
}

process.on("uncaughtException", (err) => {
    logError(TAG, "Uncaught exception", err);
});

process.on("unhandledRejection", (reason) => {
    logError(TAG, "Unhandled rejection", reason);
});

startServer().catch((err) => {
    logError(TAG, "Failed to start server", err);
    process.exit(1);
});
