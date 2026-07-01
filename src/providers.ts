import { extractDateFromPanoId } from '@/composables/utils';
import { cacheManager, coordinateCache, getCoordinateCacheKey } from '@/cache';
import gcoord from 'gcoord';
import {
  LatLng,
  Size,
  StreetViewStatus,
  type StreetViewLocationRequest,
  type StreetViewPanoramaData,
} from '@/streetview-types';

async function fetchPanoIdFromCoords(
  lng: number,
  lat: number,
  radius: number,
): Promise<string | undefined> {
  const cacheKey = getCoordinateCacheKey(lng, lat, radius);
  const cached = coordinateCache.lookup(cacheKey);

  if (cached.type === 'negative') {
    return undefined;
  }
  if (cached.type === 'positive') {
    return cached.panoId;
  }

  const [bd09mcLng, bd09mcLat] = gcoord.transform([lng, lat], gcoord.WGS84, gcoord.BD09MC);
  const uri = `https://mapsv0.bdimg.com/?qt=qsdata&x=${bd09mcLng}&y=${bd09mcLat}&r=${radius}`;
  const resp = await fetch(uri);
  const json = await resp.json();
  const panoId: string | undefined = json?.content?.id;

  if (!panoId) {
    coordinateCache.setNegative(cacheKey);
    return undefined;
  }

  coordinateCache.setPositive(cacheKey, panoId);
  return panoId;
}

async function buildPanoramaFromId(panoId: string): Promise<StreetViewPanoramaData | null> {
  const uri = `https://mapsv0.bdimg.com/?qt=sdata&sid=${panoId}`;
  const resp = await fetch(uri);
  const json = await resp.json();
  const result = json.content[0];

  if (!result?.ID) {
    return null;
  }

  const date = extractDateFromPanoId(panoId.slice(10, 22));
  const [lng, lat] = gcoord.transform(
    [result.X / 100, result.Y / 100],
    gcoord.BD09MC,
    gcoord.GCJ02,
  );
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
    copyright: '© 百度街景',
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
  };
  cacheManager.set('baidu', panoId, panorama);
  return panorama;
}

async function getFromBaidu(
  request: StreetViewLocationRequest,
  onCompleted: (res: StreetViewPanoramaData | null, status: StreetViewStatus) => void,
) {
  try {
    if (request.pano && cacheManager.has('baidu', request.pano)) {
      onCompleted(cacheManager.get('baidu', request.pano)!, StreetViewStatus.OK);
      return;
    }

    let panoId: string | undefined;

    if (request.pano) {
      panoId = request.pano;
    } else if (request.location) {
      const lat =
        typeof request.location.lat === 'function' ? request.location.lat() : request.location.lat;
      const lng =
        typeof request.location.lng === 'function' ? request.location.lng() : request.location.lng;
      const r = request.radius || 50;
      panoId = await fetchPanoIdFromCoords(lng, lat, r);
    }

    if (!panoId) {
      onCompleted(null, StreetViewStatus.ZERO_RESULTS);
      return;
    }

    if (cacheManager.has('baidu', panoId)) {
      onCompleted(cacheManager.get('baidu', panoId)!, StreetViewStatus.OK);
      return;
    }

    const panorama = await buildPanoramaFromId(panoId);
    if (!panorama) {
      onCompleted(null, StreetViewStatus.ZERO_RESULTS);
      return;
    }

    onCompleted(panorama, StreetViewStatus.OK);
  } catch {
    onCompleted(null, StreetViewStatus.UNKNOWN_ERROR);
  }
}

const StreetViewProviders = {
  getPanorama: async (
    request: StreetViewLocationRequest,
    onCompleted: (res: StreetViewPanoramaData | null, status: StreetViewStatus) => void,
  ) => {
    await getFromBaidu(request, onCompleted);
  },
};

export default StreetViewProviders;
