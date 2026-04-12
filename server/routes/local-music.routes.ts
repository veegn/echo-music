import fs from "fs";
import path from "path";
import { Router, RequestHandler, Request, Response, NextFunction } from "express";
import * as musicCacheService from "../services/music-cache.service.js";
import { logError } from "../logger.js";

const TAG = "LocalMusicRoutes";

function streamFile(res: any, filePath: string, inline = true) {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("Content-Disposition", `${inline ? "inline" : "attachment"}; filename="${path.basename(filePath)}"`);
    res.sendFile(filePath, (err: any) => {
        if (err && err.code !== "ECONNABORTED" && err.code !== "EPIPE" && !res.headersSent) {
            logError(TAG, "Failed to send file", err, { filePath });
        }
    });
}

function asyncHandler(fn: RequestHandler): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(err => {
            logError(TAG, "API Error", err);
            if (!res.headersSent) {
                res.status(500).json({ error: err.message || "Internal server error" });
            }
        });
    };
}

export default function createLocalMusicRouter(): Router {
    const router = Router();

    router.get("/stats", asyncHandler(async (_req, res) => {
        res.json(musicCacheService.getCachedTrackStats());
    }));

    router.get("/tracks", asyncHandler(async (_req, res) => {
        const page = Number(_req.query.page || 1);
        const pageSize = Number(_req.query.pageSize || 20);
        res.json(musicCacheService.searchCachedTracksPage("", page, pageSize));
    }));

    router.get("/search", asyncHandler(async (req, res) => {
        const query = String(req.query.q || "");
        const page = Number(req.query.page || 1);
        const pageSize = Number(req.query.pageSize || 20);
        res.json(musicCacheService.searchCachedTracksPage(query, page, pageSize));
    }));

    router.get("/tracks/:songmid", asyncHandler(async (req, res) => {
        const track = musicCacheService.getCachedTrack(String(req.params.songmid));
        if (!track) return res.status(404).json({ error: "Cached track not found" });
        return res.json(track);
    }));

    router.get("/jobs/:jobId", asyncHandler(async (req, res) => {
        const job = musicCacheService.getCacheJob(String(req.params.jobId));
        if (!job) return res.status(404).json({ error: "Cache job not found" });
        return res.json(job);
    }));

    router.get("/audio/:songmid", asyncHandler(async (req, res) => {
        const filePath = musicCacheService.getCachedAudioFile(String(req.params.songmid));
        if (!filePath) return res.status(404).json({ error: "Cached audio not found" });
        streamFile(res, filePath);
    }));

    router.get("/cover/:songmid", asyncHandler(async (req, res) => {
        const filePath = musicCacheService.getCachedCoverFile(String(req.params.songmid));
        if (!filePath) return res.status(404).json({ error: "Cached cover not found" });
        streamFile(res, filePath);
    }));

    router.post("/tracks/:songmid/recache", asyncHandler(async (req, res) => {
        const job = musicCacheService.enqueueRecacheTrack(String(req.params.songmid));
        if (!job) return res.status(404).json({ error: "Cached track not found" });
        return res.status(202).json({ success: true, job });
    }));

    router.delete("/tracks/:songmid", asyncHandler(async (req, res) => {
        const job = musicCacheService.enqueueDeleteTrack(String(req.params.songmid));
        if (!job) return res.status(404).json({ error: "Cached track not found" });
        return res.status(202).json({ success: true, job });
    }));

    router.post("/tracks/bulk-delete", asyncHandler(async (req, res) => {
        const songmids = Array.isArray(req.body?.songmids) ? req.body.songmids.map(String) : [];
        const job = musicCacheService.enqueueDeleteTracks(songmids);
        if (!job) return res.status(404).json({ error: "Cached tracks not found" });
        return res.status(202).json({ success: true, job });
    }));

    return router;
}
