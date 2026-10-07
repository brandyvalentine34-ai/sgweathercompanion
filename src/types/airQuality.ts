export type RegionName = 'north' | 'south' | 'east' | 'west' | 'central';

export interface RegionCoordinates {
  latitude: number;
  longitude: number;
}

export interface RegionReading {
  region: RegionName;
  label: string;
  coordinates: RegionCoordinates;
  psi24Hr: number;
  pm25OneHr: number;
  pm25TwentyFourHr: number;
  pm25SubIndex: number;
  pm10TwentyFourHr: number;
  pm10SubIndex: number;
  o3EightHrMax: number;
  o3SubIndex: number;
  no2OneHrMax: number;
  so2TwentyFourHr: number;
  so2SubIndex: number;
  coEightHrMax: number;
  coSubIndex: number;
}

export interface AirQualitySnapshot {
  timestamp: string;
  updatedTimestamp: string;
  date: string;
  regions: Record<RegionName, RegionReading>;
  nationalMaxPsi: number;
  nationalMaxPm25: number;
  nationalAvgPsi: number;
  nationalAvgPm25: number;
  dominantHazeRegion: RegionName;
  isSimulated: boolean;
}

export interface ApiProbeResult {
  name: string;
  endpoint: string;
  status: 'NOMINAL' | 'DEGRADED' | 'OFFLINE';
  httpStatus: number;
  latencyMs: number;
  code?: number | null;
  regionsCount?: number;
  dataTimestamp: string | null;
  updatedTimestamp?: string | null;
  error: string | null;
}

export interface ApiHealthReport {
  overallStatus: 'NOMINAL' | 'DEGRADED' | 'CRITICAL';
  checkedAt: string;
  averageLatencyMs: number;
  services: {
    psi: ApiProbeResult;
    pm25: ApiProbeResult;
  };
}

export type AirQualityBandId = 'GOOD' | 'MODERATE' | 'UNHEALTHY' | 'VERY_UNHEALTHY' | 'HAZARDOUS';

export interface AirQualityBandInfo {
  id: AirQualityBandId;
  label: string;
  glyph: string; // Non-hue-only symbol
  colorHex: string;
  bgSubtle: string;
  textClass: string;
  borderClass: string;
  ringClass: string;
  psiRange: string;
  pm25Range: string;
  advisoryGeneral: string;
  advisorySensitive: string;
  advisoryOutdoor: string;
  hazeIntensity: number; // 0 to 1
}

export const REGIONS_LIST: RegionName[] = ['north', 'south', 'east', 'west', 'central'];

export const REGION_LABELS: Record<RegionName, { name: string; hubs: string; sectorCode: string; defaultCoords: RegionCoordinates }> = {
  north: {
    name: 'North Sector',
    hubs: 'Woodlands · Yishun · Sembawang · Mandai',
    sectorCode: 'SG-N01',
    defaultCoords: { latitude: 1.41803, longitude: 103.82 },
  },
  south: {
    name: 'South Sector',
    hubs: 'Sentosa · HarbourFront · Bukit Merah · Marina South',
    sectorCode: 'SG-S02',
    defaultCoords: { latitude: 1.29587, longitude: 103.82 },
  },
  east: {
    name: 'East Sector',
    hubs: 'Tampines · Changi · Bedok · Pasir Ris',
    sectorCode: 'SG-E03',
    defaultCoords: { latitude: 1.35735, longitude: 103.94 },
  },
  west: {
    name: 'West Sector',
    hubs: 'Jurong · Clementi · Tuas · Bukit Batok',
    sectorCode: 'SG-W04',
    defaultCoords: { latitude: 1.35735, longitude: 103.7 },
  },
  central: {
    name: 'Central Sector',
    hubs: 'Orchard · Bishan · Toa Payoh · Downtown Core',
    sectorCode: 'SG-C05',
    defaultCoords: { latitude: 1.35735, longitude: 103.82 },
  },
};

export interface SingaporePresetLocation {
  name: string;
  area: string;
  latitude: number;
  longitude: number;
  region: RegionName;
}

export const SINGAPORE_PRESET_LOCATIONS: SingaporePresetLocation[] = [
  { name: 'Marina Bay Sands / Downtown', area: 'Downtown Core', latitude: 1.2834, longitude: 103.8607, region: 'south' },
  { name: 'Orchard Road / Somerset', area: 'Central Area', latitude: 1.3048, longitude: 103.8318, region: 'central' },
  { name: 'Bishan / Ang Mo Kio Hub', area: 'Central North', latitude: 1.3526, longitude: 103.8485, region: 'central' },
  { name: 'Woodlands Causeway', area: 'North Region', latitude: 1.4382, longitude: 103.7890, region: 'north' },
  { name: 'Jurong East / JEM', area: 'West Region', latitude: 1.3329, longitude: 103.7436, region: 'west' },
  { name: 'Tuas Biomedical Park', area: 'Far West', latitude: 1.2940, longitude: 103.6350, region: 'west' },
  { name: 'Tampines Regional Centre', area: 'East Region', latitude: 1.3521, longitude: 103.9452, region: 'east' },
  { name: 'Changi Airport Terminal 3', area: 'Far East', latitude: 1.3563, longitude: 103.9869, region: 'east' },
  { name: 'Sentosa Island / Palawan', area: 'Southern Islands', latitude: 1.2494, longitude: 103.8303, region: 'south' },
];

/**
 * Classifies PSI (24-hr) based on official Singapore NEA bands
 */
export function getPsiBand(psi: number): AirQualityBandInfo {
  if (psi <= 50) {
    return {
      id: 'GOOD',
      label: 'GOOD',
      glyph: '●',
      colorHex: '#10B981',
      bgSubtle: 'rgba(16, 185, 129, 0.12)',
      textClass: 'text-emerald-400',
      borderClass: 'border-emerald-500/40',
      ringClass: 'ring-emerald-500/20',
      psiRange: '0 – 50',
      pm25Range: '0 – 12 µg/m³',
      advisoryGeneral: 'Normal outdoor activities can be continued without restriction.',
      advisorySensitive: 'Normal activities.',
      advisoryOutdoor: 'Unrestricted outdoor endurance and training permitted.',
      hazeIntensity: 0,
    };
  }
  if (psi <= 100) {
    return {
      id: 'MODERATE',
      label: 'MODERATE',
      glyph: '◆',
      colorHex: '#06B6D4',
      bgSubtle: 'rgba(6, 182, 212, 0.12)',
      textClass: 'text-cyan-400',
      borderClass: 'border-cyan-500/40',
      ringClass: 'ring-cyan-500/20',
      psiRange: '51 – 100',
      pm25Range: '13 – 55 µg/m³',
      advisoryGeneral: 'Normal activities can be continued.',
      advisorySensitive: 'Persons who arenot feeling well, especially the elderly and children, and those with chronic heart or lung conditions, should seek medical attention.',
      advisoryOutdoor: 'Normal outdoor activities; monitor sensitive individuals.',
      hazeIntensity: Math.max(0, (psi - 65) / 140),
    };
  }
  if (psi <= 200) {
    return {
      id: 'UNHEALTHY',
      label: 'UNHEALTHY',
      glyph: '▲',
      colorHex: '#F59E0B',
      bgSubtle: 'rgba(245, 158, 11, 0.15)',
      textClass: 'text-amber-400',
      borderClass: 'border-amber-500/50',
      ringClass: 'ring-amber-500/25',
      psiRange: '101 – 200',
      pm25Range: '56 – 150 µg/m³',
      advisoryGeneral: 'Reduce prolonged or strenuous outdoor physical exertion.',
      advisorySensitive: 'Avoid prolonged or strenuous outdoor physical exertion. Elderly, pregnant women, children, and chronic lung/heart patients should minimize outdoor exposure.',
      advisoryOutdoor: 'Limit prolonged outdoor exertion; activate indoor air filtration.',
      hazeIntensity: Math.min(0.65, 0.25 + ((psi - 100) / 100) * 0.4),
    };
  }
  if (psi <= 300) {
    return {
      id: 'VERY_UNHEALTHY',
      label: 'VERY UNHEALTHY',
      glyph: '■',
      colorHex: '#F97316',
      bgSubtle: 'rgba(249, 115, 22, 0.18)',
      textClass: 'text-orange-400',
      borderClass: 'border-orange-500/60',
      ringClass: 'ring-orange-500/30',
      psiRange: '201 – 300',
      pm25Range: '151 – 250 µg/m³',
      advisoryGeneral: 'Avoid prolonged or strenuous outdoor physical exertion.',
      advisorySensitive: 'Avoid all outdoor activity. Stay indoors with windows closed and air purifiers running.',
      advisoryOutdoor: 'Suspend outdoor sports and physical work; N95 masks advised for essential outdoor tasks.',
      hazeIntensity: Math.min(0.85, 0.65 + ((psi - 200) / 100) * 0.2),
    };
  }
  return {
    id: 'HAZARDOUS',
    label: 'HAZARDOUS',
    glyph: '✖',
    colorHex: '#F43F5E',
    bgSubtle: 'rgba(244, 63, 94, 0.22)',
    textClass: 'text-rose-400',
    borderClass: 'border-rose-500/70',
    ringClass: 'ring-rose-500/35',
    psiRange: '> 300',
    pm25Range: '> 250 µg/m³',
    advisoryGeneral: 'Minimize all outdoor activity. Remain indoors with HEPA filtration.',
    advisorySensitive: 'Stay indoors at all times. Keep windows and doors sealed; use N95 respirator if outdoor transit is unavoidable.',
    advisoryOutdoor: 'Critical transboundary haze event. All outdoor work and public events must cease.',
    hazeIntensity: 1.0,
  };
}

/**
 * Classifies 1-hr PM2.5 (µg/m³) based on Singapore NEA 1-hr PM2.5 Concentration Bands:
 * Normal (Band I): 0 - 55 µg/m³
 * Elevated (Band II): 56 - 150 µg/m³
 * High (Band III): 151 - 250 µg/m³
 * Very High (Band IV): > 250 µg/m³
 */
export function getPm25Band(pm25: number): AirQualityBandInfo {
  if (pm25 <= 55) {
    const isVeryClean = pm25 <= 15;
    return {
      id: isVeryClean ? 'GOOD' : 'MODERATE',
      label: isVeryClean ? 'BAND I · NORMAL (LOW)' : 'BAND I · NORMAL',
      glyph: isVeryClean ? '●' : '◆',
      colorHex: isVeryClean ? '#10B981' : '#06B6D4',
      bgSubtle: isVeryClean ? 'rgba(16, 185, 129, 0.12)' : 'rgba(6, 182, 212, 0.12)',
      textClass: isVeryClean ? 'text-emerald-400' : 'text-cyan-400',
      borderClass: isVeryClean ? 'border-emerald-500/40' : 'border-cyan-500/40',
      ringClass: isVeryClean ? 'ring-emerald-500/20' : 'ring-cyan-500/20',
      psiRange: '0 – 100',
      pm25Range: '0 – 55 µg/m³',
      advisoryGeneral: 'Normal activities can be continued.',
      advisorySensitive: 'Normal activities.',
      advisoryOutdoor: 'Unrestricted outdoor activity.',
      hazeIntensity: pm25 > 35 ? (pm25 - 35) / 150 : 0,
    };
  }
  if (pm25 <= 150) {
    return {
      id: 'UNHEALTHY',
      label: 'BAND II · ELEVATED',
      glyph: '▲',
      colorHex: '#F59E0B',
      bgSubtle: 'rgba(245, 158, 11, 0.15)',
      textClass: 'text-amber-400',
      borderClass: 'border-amber-500/50',
      ringClass: 'ring-amber-500/25',
      psiRange: '101 – 200',
      pm25Range: '56 – 150 µg/m³',
      advisoryGeneral: 'Reduce prolonged or strenuous outdoor physical exertion.',
      advisorySensitive: 'Avoid prolonged or strenuous outdoor physical exertion.',
      advisoryOutdoor: 'Fine particulate matter elevated; reduce intense outdoor cardio.',
      hazeIntensity: Math.min(0.65, 0.25 + ((pm25 - 55) / 95) * 0.4),
    };
  }
  if (pm25 <= 250) {
    return {
      id: 'VERY_UNHEALTHY',
      label: 'BAND III · HIGH',
      glyph: '■',
      colorHex: '#F97316',
      bgSubtle: 'rgba(249, 115, 22, 0.18)',
      textClass: 'text-orange-400',
      borderClass: 'border-orange-500/60',
      ringClass: 'ring-orange-500/30',
      psiRange: '201 – 300',
      pm25Range: '151 – 250 µg/m³',
      advisoryGeneral: 'Avoid prolonged or strenuous outdoor physical exertion.',
      advisorySensitive: 'Avoid all outdoor physical activity.',
      advisoryOutdoor: 'High PM2.5 density. Remain indoors and seal ventilation.',
      hazeIntensity: Math.min(0.85, 0.65 + ((pm25 - 150) / 100) * 0.2),
    };
  }
  return {
    id: 'HAZARDOUS',
    label: 'BAND IV · VERY HIGH',
    glyph: '✖',
    colorHex: '#F43F5E',
    bgSubtle: 'rgba(244, 63, 94, 0.22)',
    textClass: 'text-rose-400',
    borderClass: 'border-rose-500/70',
    ringClass: 'ring-rose-500/35',
    psiRange: '> 300',
    pm25Range: '> 250 µg/m³',
    advisoryGeneral: 'Minimize all outdoor activity.',
    advisorySensitive: 'Stay indoors at all times; N95 respirator required if going outdoors.',
    advisoryOutdoor: 'Severe particulate concentration (>250 µg/m³).',
    hazeIntensity: 1.0,
  };
}

/**
 * Calculates great-circle distance in kilometers between two coordinates using Haversine formula
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Finds the nearest Singapore NEA monitoring sector to a user's coordinates
 */
export function findNearestRegion(
  lat: number,
  lon: number,
  regions: Record<RegionName, RegionReading>
): { region: RegionName; distanceKm: number } {
  let closestRegion: RegionName = 'central';
  let minDistance = Infinity;

  for (const r of REGIONS_LIST) {
    const coords = regions[r]?.coordinates || REGION_LABELS[r].defaultCoords;
    const dist = calculateDistanceKm(lat, lon, coords.latitude, coords.longitude);
    if (dist < minDistance) {
      minDistance = dist;
      closestRegion = r;
    }
  }

  return { region: closestRegion, distanceKm: minDistance };
}

/**
 * Parses raw NEA API responses from /v2/real-time/api/psi and /v2/real-time/api/pm25
 */
export function parseNeaResponses(psiRaw: any, pm25Raw: any): AirQualitySnapshot {
  const psiData = psiRaw?.data;
  const pm25Data = pm25Raw?.data;

  const psiItem = psiData?.items?.[0] || {};
  const pm25Item = pm25Data?.items?.[0] || {};

  const psiReadings = psiItem.readings || {};
  const pm25Readings = pm25Item.readings || {};

  const coordMap: Partial<Record<RegionName, RegionCoordinates>> = {};
  if (Array.isArray(psiData?.regionMetadata)) {
    for (const meta of psiData.regionMetadata) {
      const name = meta.name as RegionName;
      if (REGIONS_LIST.includes(name) && meta.labelLocation) {
        coordMap[name] = {
          latitude: Number(meta.labelLocation.latitude),
          longitude: Number(meta.labelLocation.longitude),
        };
      }
    }
  }

  const regions = {} as Record<RegionName, RegionReading>;
  let maxPsi = 0;
  let maxPm25 = 0;
  let sumPsi = 0;
  let sumPm25 = 0;
  let dominantHazeRegion: RegionName = 'central';
  let highestScore = -1;

  for (const r of REGIONS_LIST) {
    const psi24Hr = Number(psiReadings.psi_twenty_four_hourly?.[r] ?? 50);
    const pm25OneHr = Number(pm25Readings.pm25_one_hourly?.[r] ?? psiReadings.pm25_twenty_four_hourly?.[r] ?? 20);
    const pm25TwentyFourHr = Number(psiReadings.pm25_twenty_four_hourly?.[r] ?? pm25OneHr);
    const pm25SubIndex = Number(psiReadings.pm25_sub_index?.[r] ?? psi24Hr);
    const pm10TwentyFourHr = Number(psiReadings.pm10_twenty_four_hourly?.[r] ?? 40);
    const pm10SubIndex = Number(psiReadings.pm10_sub_index?.[r] ?? 40);
    const o3EightHrMax = Number(psiReadings.o3_eight_hour_max?.[r] ?? 30);
    const o3SubIndex = Number(psiReadings.o3_sub_index?.[r] ?? 15);
    const no2OneHrMax = Number(psiReadings.no2_one_hour_max?.[r] ?? 15);
    const so2TwentyFourHr = Number(psiReadings.so2_twenty_four_hourly?.[r] ?? 5);
    const so2SubIndex = Number(psiReadings.so2_sub_index?.[r] ?? 3);
    const coEightHrMax = Number(psiReadings.co_eight_hour_max?.[r] ?? 0.5);
    const coSubIndex = Number(psiReadings.co_sub_index?.[r] ?? 5);

    regions[r] = {
      region: r,
      label: REGION_LABELS[r].name,
      coordinates: coordMap[r] || REGION_LABELS[r].defaultCoords,
      psi24Hr,
      pm25OneHr,
      pm25TwentyFourHr,
      pm25SubIndex,
      pm10TwentyFourHr,
      pm10SubIndex,
      o3EightHrMax,
      o3SubIndex,
      no2OneHrMax,
      so2TwentyFourHr,
      so2SubIndex,
      coEightHrMax,
      coSubIndex,
    };

    if (psi24Hr > maxPsi) maxPsi = psi24Hr;
    if (pm25OneHr > maxPm25) maxPm25 = pm25OneHr;
    sumPsi += psi24Hr;
    sumPm25 += pm25OneHr;

    const combinedSeverity = psi24Hr + pm25OneHr * 0.8;
    if (combinedSeverity > highestScore) {
      highestScore = combinedSeverity;
      dominantHazeRegion = r;
    }
  }

  return {
    timestamp: psiItem.timestamp || pm25Item.timestamp || new Date().toISOString(),
    updatedTimestamp: psiItem.updatedTimestamp || pm25Item.updatedTimestamp || new Date().toISOString(),
    date: psiItem.date || pm25Item.date || new Date().toISOString().slice(0, 10),
    regions,
    nationalMaxPsi: maxPsi,
    nationalMaxPm25: maxPm25,
    nationalAvgPsi: Math.round(sumPsi / REGIONS_LIST.length),
    nationalAvgPm25: Math.round(sumPm25 / REGIONS_LIST.length),
    dominantHazeRegion,
    isSimulated: false,
  };
}

/**
 * Generates a realistic modified snapshot when user tests atmospheric haze simulation
 */
export function applyHazeSimulation(base: AirQualitySnapshot, targetPsi: number): AirQualitySnapshot {
  const ratio = targetPsi / Math.max(1, base.nationalMaxPsi);
  const simulatedRegions = {} as Record<RegionName, RegionReading>;

  let maxPsi = 0;
  let maxPm25 = 0;
  let sumPsi = 0;
  let sumPm25 = 0;
  let dominantHazeRegion: RegionName = base.dominantHazeRegion;
  let highestScore = -1;

  const regionalVariance: Record<RegionName, number> = {
    west: 1.05,
    central: 1.0,
    south: 0.94,
    east: 0.96,
    north: 0.91,
  };

  for (const r of REGIONS_LIST) {
    const orig = base.regions[r];
    const v = regionalVariance[r];
    const psi24Hr = Math.max(12, Math.round(targetPsi * v));
    const pm25OneHr = Math.max(6, Math.round((targetPsi * 0.92) * v));
    const pm25TwentyFourHr = Math.max(8, Math.round((targetPsi * 0.72) * v));

    simulatedRegions[r] = {
      ...orig,
      psi24Hr,
      pm25OneHr,
      pm25TwentyFourHr,
      pm25SubIndex: psi24Hr,
      pm10TwentyFourHr: Math.round(orig.pm10TwentyFourHr * Math.max(0.5, ratio * 0.85)),
      pm10SubIndex: Math.round(orig.pm10SubIndex * Math.max(0.5, ratio * 0.85)),
    };

    if (psi24Hr > maxPsi) maxPsi = psi24Hr;
    if (pm25OneHr > maxPm25) maxPm25 = pm25OneHr;
    sumPsi += psi24Hr;
    sumPm25 += pm25OneHr;

    const combined = psi24Hr + pm25OneHr;
    if (combined > highestScore) {
      highestScore = combined;
      dominantHazeRegion = r;
    }
  }

  return {
    ...base,
    regions: simulatedRegions,
    nationalMaxPsi: maxPsi,
    nationalMaxPm25: maxPm25,
    nationalAvgPsi: Math.round(sumPsi / REGIONS_LIST.length),
    nationalAvgPm25: Math.round(sumPm25 / REGIONS_LIST.length),
    dominantHazeRegion,
    isSimulated: true,
  };
}
