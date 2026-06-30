import { extractDateFromPanoId } from '@/composables/utils'
import { cacheManager } from '@/cache'
import gcoord from 'gcoord'
import {
  LatLng,
  Size,
  StreetViewStatus,
  type StreetViewLocationRequest,
  type StreetViewPanoramaData,
} from '@/streetview-types'

async function getFromBaidu(
  request: StreetViewLocationRequest,
  onCompleted: (
    res: StreetViewPanoramaData | null,
    status: StreetViewStatus,
  ) => void,
) {
  try {
    if (request.pano && cacheManager.has('baidu', request.pano)) {
      onCompleted(cacheManager.get('baidu', request.pano)!, StreetViewStatus.OK)
      return
    }

    let panoId: string | undefined

    if (request.pano) {
      panoId = request.pano
    } else if (request.location) {
      const lat =
        typeof request.location.lat === 'function' ? request.location.lat() : request.location.lat
      const lng =
        typeof request.location.lng === 'function' ? request.location.lng() : request.location.lng

      const [bd09mcLng, bd09mcLat] = gcoord.transform([lng, lat], gcoord.WGS84, gcoord.BD09MC)
      const r = request.radius || 50
      const uri = `https://mapsv0.bdimg.com/?qt=qsdata&x=${bd09mcLng}&y=${bd09mcLat}&r=${r}`
      const resp = await fetch(uri)
      const json = await resp.json()
      panoId = json?.content?.id
    }

    if (!panoId) {
      onCompleted(null, StreetViewStatus.ZERO_RESULTS)
      return
    }

    const uri = `https://mapsv0.bdimg.com/?qt=sdata&sid=${panoId}`
    const resp = await fetch(uri)
    const json = await resp.json()
    const result = json.content[0]

    if (!result?.ID) {
      onCompleted(null, StreetViewStatus.ZERO_RESULTS)
      return
    }

    const date = extractDateFromPanoId(panoId.slice(10, 22))
    const [lng, lat] = gcoord.transform([result.X / 100, result.Y / 100], gcoord.BD09MC, gcoord.GCJ02)
    const panorama: StreetViewPanoramaData = {
      location: {
        pano: panoId,
        latLng: new LatLng(lat, lng),
        description: result.Rname,
        altitude: result.Z,
        country: 'CN',
      },
      links:
        result.Links?.map((r: { PID: string }) => ({
          pano: r.PID,
          heading: 0,
        })) ?? [],
      tiles: {
        centerHeading: result.Heading,
        tileSize: new Size(512, 512),
        worldSize: new Size(8192, 4096),
        getTileUrl: () => '',
      },
      imageDate: date,
      copyright: '© Baidu Maps',
      time: [
        ...(result.TimeLine?.map((r: { ID: string }) => ({
          pano: r.ID,
          date: new Date(extractDateFromPanoId(r.ID.slice(10, 22))),
        })) ?? []),
        {
          pano: panoId,
          date: new Date(date),
        },
      ].sort((a, b) => a.date.getTime() - b.date.getTime()),
    }
    cacheManager.set('baidu', panoId, panorama)
    onCompleted(panorama, StreetViewStatus.OK)
  } catch {
    onCompleted(null, StreetViewStatus.UNKNOWN_ERROR)
  }
}

const StreetViewProviders = {
  getPanorama: async (
    _provider: string,
    request: StreetViewLocationRequest,
    onCompleted: (
      res: StreetViewPanoramaData | null,
      status: StreetViewStatus,
    ) => void,
  ) => {
    await getFromBaidu(request, onCompleted)
  },
}

export default StreetViewProviders