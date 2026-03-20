export function loadController<T = unknown>(moduleId: string): T {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require(moduleId);
  return (mod?.default || mod) as T;
}
