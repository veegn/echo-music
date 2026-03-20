/**
 * Shared user information stored on globalThis.userInfo.
 * The runtime object may also include fields such as uin, cookieList,
 * and cookieObject that are added dynamically by older API modules.
 */
export interface UserInfo {
  loginUin: string;
  uin?: string;
  cookie: string;
  cookieList: string[];
  cookieObject: Record<string, string>;
  refreshData: (cookie: string) => any;
  [key: string]: any;
}

declare global {
  var userInfo: UserInfo;
}
