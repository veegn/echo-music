import request from '../../../util/request';
import { customResponse, errorResponse } from '../../../util/apiResponse';
import type { ApiResponse } from '../../../types/api';
import { debugLog as logDebug } from '../../../util/debug';

interface LikedSong {
  [key: string]: unknown;
}

const debugLog = (message: string, payload?: unknown) => {
  logDebug('getUserLikedSongs', message, payload ?? '');
};

export const getUserLikedSongs = async (params: {
  uin: string;
  offset?: number;
  limit?: number;
}): Promise<ApiResponse> => {
  const { uin, offset = 0, limit = 30 } = params;
  const page = Math.floor(offset / limit) + 1;

  const url = 'https://c6.y.qq.com/rsc/fcgi-bin/fcg_get_profile_homepage.fcg';

  try {
    debugLog('request meta', {
      url,
      uin,
      offset,
      limit,
      page,
      hasGlobalCookie: Boolean(global.userInfo?.cookie),
      cookieLength: global.userInfo?.cookie?.length || 0
    });

    const response = await request<Record<string, any>>({
      url,
      method: 'GET',
      isUUrl: 'u',
      options: {
        params: {
          _: Date.now(),
          cv: 4747474,
          ct: 24,
          format: 'json',
          inCharset: 'utf-8',
          outCharset: 'utf-8',
          notice: 0,
          platform: 'yqq.json',
          needNewCode: 0,
          uin: Number.parseInt(uin, 10),
          g_tk_new_20200303: 0,
          g_tk: 0,
          cid: 205360838,
          userid: Number.parseInt(uin, 10),
          reqfrom: 1,
          reqtype: 0,
          hostUin: 0,
          loginUin: Number.parseInt(uin, 10)
        },
        headers: {
          Referer: `https://y.qq.com/portal/profile.html?uin=${uin}`,
          Cookie: global.userInfo?.cookie || ''
        }
      }
    });

    const payload = response.data;

    debugLog('upstream payload summary', {
      topLevelKeys: payload && typeof payload === 'object' ? Object.keys(payload) : null,
      code: payload?.code,
      hasData: Boolean(payload?.data),
      dataKeys: payload?.data && typeof payload.data === 'object' ? Object.keys(payload.data) : []
    });

    if (!payload || typeof payload !== 'object') {
      debugLog('invalid payload received', payload);
      return errorResponse('Invalid liked songs response', 502);
    }

    if (typeof payload.code === 'number' && payload.code !== 0) {
      debugLog('upstream business error payload', payload);
      return errorResponse(payload.msg || payload.message || 'Failed to get liked songs', 502);
    }

    const mymusic = payload?.data?.mymusic;
    let likedSongsInfo: LikedSong | null = null;

    if (Array.isArray(mymusic)) {
      likedSongsInfo = mymusic.find((item: any) => {
        return item?.title && (item.title.includes('喜欢') || item.type === 1);
      }) || null;
    }

    debugLog('liked songs info', likedSongsInfo);

    if (!likedSongsInfo) {
      debugLog('no liked songs info found in mymusic');
      return customResponse({
        response: {
          code: 0,
          data: {
            songs: [],
            total: 0,
            hasMore: false
          }
        }
      }, 200);
    }

    return customResponse({
      response: {
        code: 0,
        data: {
          songs: [likedSongsInfo],
          total: (likedSongsInfo as any).num0 || 0,
          hasMore: false,
          info: {
            title: (likedSongsInfo as any).title,
            songCount: (likedSongsInfo as any).num0,
            albumCount: (likedSongsInfo as any).num1,
            playlistCount: (likedSongsInfo as any).num2,
            id: (likedSongsInfo as any).id
          }
        }
      }
    }, 200);
  } catch (error) {
    debugLog('request failed', error);
    return errorResponse((error as Error).message || 'Failed to get liked songs', 502);
  }
};
