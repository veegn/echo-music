import { postMusicu } from './musicu'

export async function getRadioTrack(id: number, cookie?: string) {
  return postMusicu(
    {
      songlist: {
        module: 'mb_track_radio_svr',
        method: 'get_radio_track',
        param: {
          id,
          firstplay: 1,
          num: 15
        }
      },
      radiolist: {
        module: 'pf.radiosvr',
        method: 'GetRadiolist',
        param: {
          ct: '24'
        }
      }
    },
    { cookie }
  )
}

export default {
  getRadioTrack
}
