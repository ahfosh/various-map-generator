import { extractDateFromPanoId } from '@/composables/utils';
import {
  getBaiduRoadName,
  parseBaiduCompactDate,
  parseBaiduLinks,
  toFilterDateTime,
  type BaiduSdataResult,
} from '@/composables/baiduPanorama';
import { cacheManager, coordinateCache, getCoordinateCacheKey, panoDateMetaCache } from '@/cache';
import { panoRequestQueue } from '@/concurrency';
import gcoord from 'gcoord';
import {
  LatLng,
  Size,
  StreetViewStatus,
  type StreetViewLocationRequest,
  type StreetViewPanoramaData,
} from '@/streetview-types';

/** 从 sdata 解析采集日与发布日（procdate） */
function resolveBaiduDates(panoId: string, result: BaiduSdataResult) {
  const fromPanoId =
    panoId.length >= 22 ? extractDateFromPanoId(panoId.slice(10, 22)) : undefined;
  const captureYmd = parseBaiduCompactDate(result.Date);
  // 优先 API Date 的年月日；若与 panoId 同日则保留 panoId 中的时分秒
  let imageDate = fromPanoId;
  if (captureYmd) {
    if (fromPanoId && fromPanoId.startsWith(captureYmd)) {
      imageDate = fromPanoId;
    } else {
      imageDate = `${captureYmd}T00:00:00`;
    }
  }
  const procDate = toFilterDateTime(parseBaiduCompactDate(result.procdate));
  return { imageDate, procDate };
}

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

  // Map / polygons use GCJ-02 (Petal Maps + Baidu pano markers); Baidu API needs BD-09MC
  const [bd09mcLng, bd09mcLat] = gcoord.transform([lng, lat], gcoord.GCJ02, gcoord.BD09MC);
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
  const result = json.content[0] as BaiduSdataResult | undefined;

  if (!result?.ID) {
    return null;
  }

  const roadName = getBaiduRoadName(result);
  const { imageDate, procDate } = resolveBaiduDates(panoId, result);
  panoDateMetaCache.set(panoId, imageDate, procDate);
  const [lng, lat] = gcoord.transform(
    [result.X / 100, result.Y / 100],
    gcoord.BD09MC,
    gcoord.GCJ02,
  );

  // TimeLine 条目通常只有 ID；日期用 panoId / TimeLine 字段近似（采集侧）
  const timelineEntries = (result.TimeLine ?? []).map((r) => {
    const id = r.ID;
    let dateStr: string | undefined;
    if (id?.length >= 22) {
      dateStr = extractDateFromPanoId(id.slice(10, 22));
    }
    if (!dateStr && r.TimeLine) {
      dateStr = toFilterDateTime(parseBaiduCompactDate(r.TimeLine));
    }
    return {
      pano: id,
      date: new Date(dateStr || 0),
    };
  });

  const panorama: StreetViewPanoramaData = {
    location: {
      pano: panoId,
      latLng: new LatLng(lat, lng),
      description: roadName,
      road: roadName,
      altitude: result.Z,
      pitch: typeof result.Pitch === 'number' ? result.Pitch : 0,
      country: 'CN',
    },
    links: parseBaiduLinks(result, panoId),
    tiles: {
      centerHeading: result.Heading ?? 0,
      tileSize: new Size(512, 512),
      worldSize: new Size(8192, 4096),
      getTileUrl: () => '',
    },
    imageDate,
    procDate,
    copyright: '© 百度街景',
    time: [
      ...timelineEntries,
      {
        pano: panoId,
        date: new Date(imageDate || 0),
      },
    ]
      .filter((t) => t.pano && !Number.isNaN(t.date.getTime()))
      .sort((a, b) => a.date.getTime() - b.date.getTime()),
  };
  cacheManager.set('baidu', panoId, panorama);
  return panorama;
}

type PanoramaCallback = (
  res: StreetViewPanoramaData | null,
  status: StreetViewStatus,
) => void | Promise<void>

async function invokeCallback(
  onCompleted: PanoramaCallback,
  res: StreetViewPanoramaData | null,
  status: StreetViewStatus,
) {
  const result = onCompleted(res, status)
  if (result instanceof Promise) {
    await result
  }
}

async function getFromBaidu(
  request: StreetViewLocationRequest,
  onCompleted: PanoramaCallback,
) {
  try {
    if (request.pano && cacheManager.has('baidu', request.pano)) {
      await invokeCallback(onCompleted, cacheManager.get('baidu', request.pano)!, StreetViewStatus.OK);
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
      await invokeCallback(onCompleted, null, StreetViewStatus.ZERO_RESULTS);
      return;
    }

    if (cacheManager.has('baidu', panoId)) {
      await invokeCallback(onCompleted, cacheManager.get('baidu', panoId)!, StreetViewStatus.OK);
      return;
    }

    const panorama = await buildPanoramaFromId(panoId);
    if (!panorama) {
      await invokeCallback(onCompleted, null, StreetViewStatus.ZERO_RESULTS);
      return;
    }

    await invokeCallback(onCompleted, panorama, StreetViewStatus.OK);
  } catch {
    await invokeCallback(onCompleted, null, StreetViewStatus.UNKNOWN_ERROR);
  }
}

const StreetViewProviders = {
  getPanorama: async (
    request: StreetViewLocationRequest,
    onCompleted: PanoramaCallback,
  ) => {
    await panoRequestQueue.run(() => getFromBaidu(request, onCompleted));
  },
};

export default StreetViewProviders;