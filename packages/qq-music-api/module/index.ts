export { default as downloadQQMusic } from './apis/downloadQQMusic';

export { getHotKey, getSearchByKey, getSmartbox } from './apis/searchApis';
export { songLists, songListCategories, songListDetail } from './apis/songListApis';
export {
  getMvByTag,
  getRadioLists,
  getDigitalAlbumLists,
  getLyric,
  getTopLists
} from './apis/catalogApis';
export {
  getSimilarSinger,
  getSingerMv,
  getSingerDesc,
  getSingerStarNum
} from './apis/singerApis';
export {
  getDailyRecommend,
  getPrivateFM,
  getNewSongs,
  getPersonalRecommend
} from './apis/recommendApis';

export { default as getAlbumInfo } from './apis/getAlbumInfo';
export { default as getComments } from './apis/getComments';
export { default as getQQLoginQr } from './apis/user/getQQLoginQr';
export { default as checkQQLoginQr } from './apis/user/checkQQLoginQr';
export { getUserPlaylists } from './apis/user/getUserPlaylists';
export { getUserAvatar } from './apis/user/getUserAvatar';
export { getUserLikedSongs } from './apis/user/getUserLikedSongs';
