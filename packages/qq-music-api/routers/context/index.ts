import type { Controller } from '../types';
import { loadController } from './loader';

const cookieController = loadController('./cookies') as { get: Controller; set: Controller };
const playlistTagController = loadController('./getPlaylistTags') as {
  getPlaylistTags: Controller;
  getPlaylistsByTag: Controller;
  getHotComments: Controller;
  getSingerListByArea: Controller;
};
const searchController = loadController('./searchControllers') as {
  hotKeyController: Controller;
  searchByKeyController: Controller;
  smartboxController: Controller;
};
const libraryController = loadController('./libraryControllers') as {
  digitalAlbumListsController: Controller;
  radioListsController: Controller;
  songListCategoriesController: Controller;
  songListDetailController: Controller;
  songListsController: Controller;
  topListsController: Controller;
};
const mediaController = loadController('./mediaControllers') as {
  albumInfoController: Controller;
  imageUrlController: Controller;
  lyricController: Controller;
};
const userController = loadController('./userControllers') as {
  qqLoginQrController: Controller;
  userAvatarController: Controller;
  userLikedSongsController: Controller;
  userPlaylistsController: Controller;
};
const singerController = loadController('./singerControllers') as {
  similarSingerController: Controller;
  singerAlbumController: Controller;
  singerDescController: Controller;
  singerHotsongController: Controller;
  singerListController: Controller;
  singerMvController: Controller;
  singerStarNumController: Controller;
};
const mvController = loadController('./mvControllers') as {
  mvByTagController: Controller;
};
const discoveryController = loadController('./discoveryControllers') as {
  commentsController: Controller;
  dailyRecommendController: Controller;
  downloadQQMusicController: Controller;
  newSongsController: Controller;
  personalRecommendController: Controller;
  privateFMController: Controller;
  radioTracksController: Controller;
  similarSongsController: Controller;
};
const coreController = loadController('./coreControllers') as {
  batchSongInfoController: Controller;
  batchSongListsController: Controller;
  newDisksController: Controller;
  ranksController: Controller;
  songInfoController: Controller;
  ticketInfoController: Controller;
};

const contextRouter = {
  batchGetSongInfo: coreController.batchSongInfoController,
  batchGetSongLists: coreController.batchSongListsController,
  checkQQLoginQr: loadController('./checkQQLoginQr'),
  getAlbumInfo: mediaController.albumInfoController,
  getComments: discoveryController.commentsController,
  getCookie: cookieController.get,
  getDailyRecommend: discoveryController.dailyRecommendController,
  getDigitalAlbumLists: libraryController.digitalAlbumListsController,
  getDownloadQQMusic: discoveryController.downloadQQMusicController,
  getHotComments: playlistTagController.getHotComments,
  getHotKey: searchController.hotKeyController,
  getImageUrl: mediaController.imageUrlController,
  getLyric: mediaController.lyricController,
  getMusicPlay: loadController('./getMusicPlay'),
  getMv: loadController('./getMv'),
  getMvByTag: mvController.mvByTagController,
  getMvPlay: loadController('./getMvPlay'),
  getNewDisks: coreController.newDisksController,
  getNewSongs: discoveryController.newSongsController,
  getPersonalRecommend: discoveryController.personalRecommendController,
  getPlaylistTags: playlistTagController.getPlaylistTags,
  getPlaylistsByTag: playlistTagController.getPlaylistsByTag,
  getPrivateFM: discoveryController.privateFMController,
  getQQLoginQr: userController.qqLoginQrController,
  getRadioLists: libraryController.radioListsController,
  getRadioTracks: discoveryController.radioTracksController,
  getRanks: coreController.ranksController,
  getRecommend: loadController('./getRecommend'),
  getSearchByKey: searchController.searchByKeyController,
  getSimilarSinger: singerController.similarSingerController,
  getSimilarSongs: discoveryController.similarSongsController,
  getSingerAlbum: singerController.singerAlbumController,
  getSingerDesc: singerController.singerDescController,
  getSingerHotsong: singerController.singerHotsongController,
  getSingerList: singerController.singerListController,
  getSingerListByArea: playlistTagController.getSingerListByArea,
  getSingerMv: singerController.singerMvController,
  getSingerStarNum: singerController.singerStarNumController,
  getSmartbox: searchController.smartboxController,
  getSongInfo: coreController.songInfoController,
  getSongListCategories: libraryController.songListCategoriesController,
  getSongListDetail: libraryController.songListDetailController,
  getSongLists: libraryController.songListsController,
  getTicketInfo: coreController.ticketInfoController,
  getTopLists: libraryController.topListsController,
  getUserAvatar: userController.userAvatarController,
  getUserLikedSongs: userController.userLikedSongsController,
  getUserPlaylists: userController.userPlaylistsController,
  setCookie: cookieController.set,
} satisfies Record<string, Controller>;

export default contextRouter;
