// ============================
// 统一日志工具
// ============================
// 使用带时间戳和标签的结构化日志，方便排查线上问题

const getTimestamp = (): string => {
    return new Date().toISOString();
};

const formatMeta = (meta?: Record<string, unknown>): string => {
    if (!meta || Object.keys(meta).length === 0) return '';
    return ' ' + JSON.stringify(meta);
};

/** 普通信息日志 */
export function logInfo(tag: string, message: string, meta?: Record<string, unknown>): void {
    console.log(`[${getTimestamp()}] [INFO] [${tag}] ${message}${formatMeta(meta)}`);
}

/** 警告日志 */
export function logWarn(tag: string, message: string, meta?: Record<string, unknown>): void {
    console.warn(`[${getTimestamp()}] [WARN] [${tag}] ${message}${formatMeta(meta)}`);
}

/** 错误日志 */
export function logError(tag: string, message: string, error?: unknown, meta?: Record<string, unknown>): void {
    const errMsg = error instanceof Error ? error.message : String(error ?? '');
    console.error(`[${getTimestamp()}] [ERROR] [${tag}] ${message} | ${errMsg}${formatMeta(meta)}`);
}

export default { logInfo, logWarn, logError };
