const getTimestamp = (): string => new Date().toISOString();

const formatMeta = (meta?: Record<string, unknown>): string => {
    if (!meta || Object.keys(meta).length === 0) {
        return "";
    }
    return ` ${JSON.stringify(meta)}`;
};

export function logInfo(tag: string, message: string, meta?: Record<string, unknown>): void {
    console.log(`[${getTimestamp()}] [INFO] [${tag}] ${message}${formatMeta(meta)}`);
}

export function logWarn(tag: string, message: string, meta?: Record<string, unknown>): void {
    console.warn(`[${getTimestamp()}] [WARN] [${tag}] ${message}${formatMeta(meta)}`);
}

export function logError(
    tag: string,
    message: string,
    error?: unknown,
    meta?: Record<string, unknown>,
): void {
    let errorText = "";

    if (error instanceof Error) {
        errorText = error.stack || error.message;
    } else if (error !== undefined && error !== null) {
        if (typeof error === "object") {
            const objectError = error as Record<string, unknown>;
            if (typeof objectError.stack === "string") {
                errorText = objectError.stack;
            } else if (typeof objectError.message === "string") {
                errorText = objectError.message;
            } else {
                try {
                    errorText = JSON.stringify(error);
                } catch {
                    errorText = String(error);
                }
            }
        } else {
            errorText = String(error);
        }
    }

    if (errorText) {
        console.error(`[${getTimestamp()}] [ERROR] [${tag}] ${message}${formatMeta(meta)} |\n${errorText}`);
        return;
    }

    console.error(`[${getTimestamp()}] [ERROR] [${tag}] ${message}${formatMeta(meta)}`);
}

export function logDebug(tag: string, message: string, meta?: Record<string, unknown>): void {
    if (process.env.NODE_ENV !== "production") {
        console.debug(`[${getTimestamp()}] [DEBUG] [${tag}] ${message}${formatMeta(meta)}`);
    }
}

export default { logInfo, logWarn, logError, logDebug };
