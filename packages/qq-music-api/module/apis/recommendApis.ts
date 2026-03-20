import { postMusicu } from './musicu';

const PERSONAL_RECOMMEND_CONFIG = {
  1: {
    key: 'recomPlaylist',
    method: 'get_recommend',
    module: 'music.web_srf_svr',
    param: {
      page: 0,
      num: 20,
      uin: 0,
      login: 0
    }
  },
  2: {
    key: 'radio',
    method: 'get_radio_list',
    module: 'pf.radiosvr',
    param: {
      page_offset: 1,
      page_size: 20
    }
  },
  3: {
    key: 'mv',
    method: 'GetRecommendMV',
    module: 'gosrf.Stream.MvUrlProxy',
    param: {
      size: 20
    }
  }
} as const;

const DEFAULT_PERSONAL_RECOMMEND_TYPE = 1;
const DEFAULT_SIMILAR_SONG_LIMIT = 20;
const DEFAULT_NEW_SONG_TYPE = 5;

function resolveRecommendConfig(type: number) {
  return PERSONAL_RECOMMEND_CONFIG[
    type as keyof typeof PERSONAL_RECOMMEND_CONFIG
  ] || PERSONAL_RECOMMEND_CONFIG[DEFAULT_PERSONAL_RECOMMEND_TYPE];
}

function normalizeNewSongType(areaId: number) {
  return Number.isInteger(areaId) && areaId >= 1 && areaId <= 5
    ? areaId
    : DEFAULT_NEW_SONG_TYPE;
}

export async function getPersonalRecommend(type: number = 1, cookie?: string) {
  const recommendConfig = resolveRecommendConfig(type);
  return postMusicu(
    {
      [recommendConfig.key]: {
        method: recommendConfig.method,
        module: recommendConfig.module,
        param: recommendConfig.param
      }
    },
    { cookie }
  );
}

export async function getSimilarSongs(songmid: string, cookie?: string) {
  return postMusicu(
    {
      similarSong: {
        method: 'get_similar_song_info',
        module: 'music.web_srf_svr',
        param: {
          songid: 0,
          songmid,
          num: DEFAULT_SIMILAR_SONG_LIMIT
        }
      }
    },
    { cookie }
  );
}

export async function getDailyRecommend(cookie?: string) {
  return postMusicu(
    {
      recommend: {
        method: 'get_recommend',
        module: 'music.web_srf_svr',
        param: {
          page: 0,
          num: 20,
          uin: 0,
          login: 0
        }
      }
    },
    { cookie }
  );
}

export async function getPrivateFM(cookie?: string) {
  return postMusicu(
    {
      fm: {
        method: 'GetPrivateFmPlaylist',
        module: 'music.web_fm_svr',
        param: {
          enc: 'utf8',
          moter: 0,
          uin: 0,
          login: 0
        }
      }
    },
    { cookie }
  );
}

export async function getNewSongs(areaId: number = DEFAULT_NEW_SONG_TYPE, limit: number = 20) {
  const normalizedType = normalizeNewSongType(areaId);
  const normalizedLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 20;
  return postMusicu(
    {
      new_song: {
        module: 'newsong.NewSongServer',
        method: 'get_new_song_info',
        param: {
          type: normalizedType,
          num: normalizedLimit
        }
      }
    }
  );
}
