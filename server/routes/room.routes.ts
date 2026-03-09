// ============================
// 房间管理 API 路由
// ============================

import { Router } from "express";
import * as roomService from "../services/room.service.js";
import { logInfo, logWarn } from "../logger.js";

const TAG = "RoomRoutes";
const router = Router();

/** POST /api/rooms — 创建房间 */
router.post("/", (req, res) => {
    const { name, password, hostName } = req.body;

    if (!name || !hostName) {
        logWarn(TAG, "创建房间参数缺失", { name, hostName });
        return res.status(400).json({ error: "房间名称和主持人昵称为必填项" });
    }

    const { id, existing } = roomService.createRoom(name, password || '', hostName);
    res.json({ id, existing });
});

/** GET /api/rooms — 获取房间列表 */
router.get("/", (_req, res) => {
    const publicRooms = roomService.listPublicRooms();
    res.json(publicRooms);
});

/** POST /api/rooms/:id/verify — 验证房间密码 */
router.post("/:id/verify", (req, res) => {
    const { password } = req.body;
    const result = roomService.verifyRoomPassword(req.params.id, password);

    if (!result.success) {
        const status = result.error === "Room not found" ? 404 : 401;
        return res.status(status).json({ error: result.error });
    }
    res.json({ success: true });
});

export default router;
