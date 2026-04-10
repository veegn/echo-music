import fs from "fs";
import path from "path";
import { Router } from "express";
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

export default function createLocalMusicRouter(): Router {
    const router = Router();

    router.get("/stats", (_req, res) => {
        res.json(musicCacheService.getCachedTrackStats());
    });

    router.get("/tracks", (_req, res) => {
        const page = Number(_req.query.page || 1);
        const pageSize = Number(_req.query.pageSize || 20);
        res.json(musicCacheService.searchCachedTracksPage("", page, pageSize));
    });

    router.get("/search", (req, res) => {
        const query = String(req.query.q || "");
        const page = Number(req.query.page || 1);
        const pageSize = Number(req.query.pageSize || 20);
        res.json(musicCacheService.searchCachedTracksPage(query, page, pageSize));
    });

    router.get("/tracks/:songmid", (req, res) => {
        const track = musicCacheService.getCachedTrack(String(req.params.songmid));
        if (!track) {
            return res.status(404).json({ error: "Cached track not found" });
        }
        return res.json(track);
    });

    router.get("/jobs/:jobId", (req, res) => {
        const job = musicCacheService.getCacheJob(String(req.params.jobId));
        if (!job) {
            return res.status(404).json({ error: "Cache job not found" });
        }
        return res.json(job);
    });

    router.get("/audio/:songmid", (req, res) => {
        const filePath = musicCacheService.getCachedAudioFile(String(req.params.songmid));
        if (!filePath) {
            return res.status(404).json({ error: "Cached audio not found" });
        }

        try {
            streamFile(res, filePath);
        } catch (error) {
            logError(TAG, "Failed to stream cached audio", error, { songmid: req.params.songmid });
            res.status(500).json({ error: "Failed to stream cached audio" });
        }
    });

    router.get("/cover/:songmid", (req, res) => {
        const filePath = musicCacheService.getCachedCoverFile(String(req.params.songmid));
        if (!filePath) {
            return res.status(404).json({ error: "Cached cover not found" });
        }

        try {
            streamFile(res, filePath);
        } catch (error) {
            logError(TAG, "Failed to stream cached cover", error, { songmid: req.params.songmid });
            res.status(500).json({ error: "Failed to stream cached cover" });
        }
    });

    router.post("/tracks/:songmid/recache", (req, res) => {
        try {
            const job = musicCacheService.enqueueRecacheTrack(String(req.params.songmid));
            if (!job) {
                return res.status(404).json({ error: "Cached track not found" });
            }
            return res.status(202).json({
                success: true,
                job,
            });
        } catch (error) {
            logError(TAG, "Failed to recache track", error, { songmid: req.params.songmid });
            return res.status(500).json({ error: "Failed to recache track" });
        }
    });

    router.delete("/tracks/:songmid", (req, res) => {
        const removed = musicCacheService.removeCachedTrack(String(req.params.songmid));
        if (!removed) {
            return res.status(404).json({ error: "Cached track not found" });
        }
        return res.json({ success: true });
    });

    return router;
}
