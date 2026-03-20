import { Controller } from '../types';
import { createMusicuPayload, getMusicu } from '../../module/apis/musicu';
import { errorLog } from '../../util/debug';
import { setInternalError } from '../util';

const controller: Controller = async (ctx) => {
  const data = {
    category: {
      method: 'get_hot_category',
      param: {
        qq: ''
      },
      module: 'music.web_category_svr'
    },
    recomPlaylist: {
      method: 'get_hot_recommend',
      param: {
        async: 1,
        cmd: 2
      },
      module: 'playlist.HotRecommendServer'
    },
    playlist: {
      method: 'get_playlist_by_category',
      param: {
        id: 8,
        curPage: 1,
        size: 40,
        order: 5,
        titleid: 8
      },
      module: 'playlist.PlayListPlazaServer'
    },
    new_song: {
      module: 'newsong.NewSongServer',
      method: 'get_new_song_info',
      param: {
        type: 5
      }
    },
    new_album: {
      module: 'newalbum.NewAlbumServer',
      method: 'get_new_album_info',
      param: {
        area: 1,
        sin: 0,
        num: 10
      }
    },
    new_album_tag: {
      module: 'newalbum.NewAlbumServer',
      method: 'get_new_album_area',
      param: {}
    },
    toplist: {
      module: 'musicToplist.ToplistInfoServer',
      method: 'GetAll',
      param: {}
    },
    focus: {
      module: 'QQMusic.MusichallServer',
      method: 'GetFocus',
      param: {}
    }
  };
  
  const params = {
    format: 'json',
    data: JSON.stringify(createMusicuPayload(data, { ct: 24 }))
  };
  
  try {
    const res = await getMusicu(params);
    ctx.status = 200;
    ctx.body = {
      response: res.data
    };
  } catch (error) {
    errorLog('getRecommend', 'request error', error);
    setInternalError(ctx, 'failed to load recommend data');
  }
};

export default controller;
