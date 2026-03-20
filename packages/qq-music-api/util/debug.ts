export function isDebugEnabled() {
  return process.env.DEBUG === 'true';
}

export function debugLog(scope: string, message: string, payload?: unknown) {
  if (!isDebugEnabled()) {
    return;
  }

  if (payload === undefined) {
    console.log(`[${scope}] ${message}`);
    return;
  }

  console.log(`[${scope}] ${message}`, payload);
}

export function errorLog(scope: string, message: string, payload?: unknown) {
  if (payload === undefined) {
    console.error(`[${scope}] ${message}`);
    return;
  }

  console.error(`[${scope}] ${message}`, payload);
}
