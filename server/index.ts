import express from "express";
import { createServer } from "http";
import fs from "fs";
import path from "path";
import { Server } from "socket.io";

import { logError, logInfo } from "./logger.js";
import createOfflineLibraryRouter from "./routes/offline-library.routes.js";
import createQQMusicRouter from "./routes/qqmusic.routes.js";
import roomRoutes from "./routes/room.routes.js";
import * as musicCacheService from "./services/music-cache.service.js";
import { registerSocketHandlers } from "./socket/room.handler.js";

const TAG = "Server";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: { origin: "*" },
});

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function replaceMetaTag(html: string, selector: "name" | "property", key: string, value: string): string {
    const escapedValue = escapeHtml(value);
    const pattern = new RegExp(`(<meta\\s+${selector}="${key}"\\s+content=")([^"]*)(".*?>)`, "i");
    return html.replace(pattern, `$1${escapedValue}$3`);
}

function replaceCanonical(html: string, href: string): string {
    const escapedHref = escapeHtml(href);
    return html.replace(/(<link\s+rel="canonical"\s+href=")([^"]*)(".*?>)/i, `$1${escapedHref}$3`);
}

function replaceTitle(html: string, title: string): string {
    return html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
}

function buildAbsoluteUrl(req: express.Request, pathname: string): string {
    const host = req.get("host") || `localhost:${process.env.PORT || 3000}`;
    const protocol = req.protocol || "http";
    return `${protocol}://${host}${pathname}`;
}

function renderSeoHtml(req: express.Request, baseHtml: string): string {
    const pathname = req.path;
    const songmidMatch = pathname.match(/^\/offline-library\/([^/?#]+)/);
    const track = songmidMatch
        ? musicCacheService.getCachedTrack(decodeURIComponent(songmidMatch[1]))
        : null;

    const title = track
        ? `${track.songname} - ${track.singer} | Echo Music 离线曲库`
        : pathname.startsWith("/offline-library")
            ? "Echo Music 离线曲库 - 免登录搜索和播放缓存音乐"
            : "Echo Music - 在线一起听歌与离线曲库";
    const description = track
        ? `${track.songname}，歌手 ${track.singer}，专辑 ${track.albumname}。${track.intro || "离线曲库详情与播放页。"}`
        : pathname.startsWith("/offline-library")
            ? "Echo Music 离线曲库，支持免登录搜索、浏览、播放已缓存到本地的歌曲、封面和简介。"
            : "Echo Music，支持多人一起听歌，也支持免登录浏览和播放离线缓存音乐。";
    const canonical = buildAbsoluteUrl(req, pathname);
    const image = track?.coverUrl
        ? buildAbsoluteUrl(req, track.coverUrl)
        : buildAbsoluteUrl(req, "/favicon.ico");

    let html = baseHtml;
    html = replaceTitle(html, title);
    html = replaceMetaTag(html, "name", "description", description);
    html = replaceMetaTag(html, "property", "og:title", title);
    html = replaceMetaTag(html, "property", "og:description", description);
    html = replaceMetaTag(html, "property", "og:url", canonical);
    html = replaceMetaTag(html, "property", "og:image", image);
    html = replaceMetaTag(html, "name", "twitter:title", title);
    html = replaceMetaTag(html, "name", "twitter:description", description);
    html = replaceMetaTag(html, "name", "twitter:image", image);
    html = replaceCanonical(html, canonical);
    return html;
}

app.use(express.json());
app.use("/api/rooms", roomRoutes);
app.use("/api/qqmusic", createQQMusicRouter(io));
app.use("/api/offline-library", createOfflineLibraryRouter());

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
        app.get(/^(?!\/api).*/, (req, res) => {
            const indexPath = path.join(process.cwd(), "dist", "index.html");
            const baseHtml = fs.readFileSync(indexPath, "utf-8");
            res.type("html").send(renderSeoHtml(req, baseHtml));
        });
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
