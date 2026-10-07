import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  LocateFixed,
  RefreshCw,
  Wind,
  Activity,
  Sliders,
  MapPin,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Search,
  KeyRound,
} from 'lucide-react';
import {
  AirQualitySnapshot,
  ApiHealthReport,
  OneMapSearchResult,
  RegionName,
  REGIONS_LIST,
  REGION_LABELS,
  SINGAPORE_PRESET_LOCATIONS,
  getPsiBand,
  getPm25Band,
  findNearestRegion,
  parseNeaResponses,
  applyHazeSimulation,
} from './types/airQuality';
import { HazeWeatherCanvas } from './components/HazeWeatherCanvas';
import { SingaporeAirMap } from './components/SingaporeAirMap';
import { SubIndexRadarChart } from './components/SubIndexRadarChart';

const NEA_PSI_URL = 'https://api-open.data.gov.sg/v2/real-time/api/psi';
const NEA_PM25_URL = 'https://api-open.data.gov.sg/v2/real-time/api/pm25';

export default function App() {
  const [rawSnapshot, setRawSnapshot] = useState<AirQualitySnapshot | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Active metric toggle on interactive map ('psi' | 'pm25')
  const [activeMetric, setActiveMetric] = useState<'psi' | 'pm25'>('psi');

  // Selected Singapore region ('north' | 'south' | 'east' | 'west' | 'central')
  const [selectedRegion, setSelectedRegion] = useState<RegionName>('west');

  // User location state (detected via browser geolocation or chosen from presets / map click)
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
    label: string;
    distanceKm: number;
    nearestRegion: RegionName;
  } | null>(null);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'locating' | 'locked' | 'error'>('idle');
  const [geoFeedback, setGeoFeedback] = useState<string | null>(null);

  // Atmospheric Weather & Haze Simulation State
  // 'live' uses actual NEA reading; 'simulate' lets user test how the page looks in Clear, Moderate, Unhealthy, or Severe Haze
  const [weatherMode, setWeatherMode] = useState<'live' | 'simulate'>('live');
  const [simulatedPsi, setSimulatedPsi] = useState<number>(165);

  // /api/health.js Monitor State
  const [healthReport, setHealthReport] = useState<ApiHealthReport | null>(null);
  const [healthLoading, setHealthLoading] = useState<boolean>(false);

  // Singapore OneMap Postal Code / Building Search State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<OneMapSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState<boolean>(false);

  // Fetch real-time NEA PSI & PM2.5 data directly (with server proxy fallback)
  const fetchAirQualityData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      let psiJson: any;
      let pm25Json: any;

      try {
        const [psiRes, pm25Res] = await Promise.all([
          fetch('/api/psi', { headers: { Accept: 'application/json' } }),
          fetch('/api/pm25', { headers: { Accept: 'application/json' } }),
        ]);
        if (!psiRes.ok || !pm25Res.ok) {
          throw new Error('Local /api endpoints returned non-200 status');
        }
        [psiJson, pm25Json] = await Promise.all([psiRes.json(), pm25Res.json()]);
      } catch {
        // Fallback to direct NEA open API fetch if needed
        const [psiRes, pm25Res] = await Promise.all([
          fetch(NEA_PSI_URL, { headers: { Accept: 'application/json' } }),
          fetch(NEA_PM25_URL, { headers: { Accept: 'application/json' } }),
        ]);
        if (!psiRes.ok || !pm25Res.ok) {
          throw new Error('Unable to reach NEA Singapore endpoints');
        }
        [psiJson, pm25Json] = await Promise.all([psiRes.json(), pm25Res.json()]);
      }

      const parsed = parseNeaResponses(psiJson, pm25Json);
      setRawSnapshot(parsed);

      // Default to dominant haze region on initial load if user hasn't locked a location
      setSelectedRegion((prev) => prev || parsed.dominantHazeRegion);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Failed to retrieve real-time air quality data from data.gov.sg'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll /api/health.js to monitor NEA API status & latency
  const fetchApiHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const res = await fetch('/api/health.js');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ApiHealthReport = await res.json();
      setHealthReport(data);
    } catch (err) {
      setHealthReport({
        overallStatus: 'CRITICAL',
        checkedAt: new Date().toISOString(),
        averageLatencyMs: 0,
        services: {
          psi: {
            name: 'NEA 24-Hr PSI & Sub-Indices API',
            endpoint: NEA_PSI_URL,
            status: 'OFFLINE',
            httpStatus: 0,
            latencyMs: 0,
            dataTimestamp: null,
            error: err instanceof Error ? err.message : 'Health probe unreachable',
          },
          pm25: {
            name: 'NEA 1-Hr PM2.5 Real-Time API',
            endpoint: NEA_PM25_URL,
            status: 'OFFLINE',
            httpStatus: 0,
            latencyMs: 0,
            dataTimestamp: null,
            error: err instanceof Error ? err.message : 'Health probe unreachable',
          },
        },
      });
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAirQualityData();
    fetchApiHealth();

    const interval = setInterval(() => {
      fetchAirQualityData();
      fetchApiHealth();
    }, 180000); // Refresh every 3 minutes
    return () => clearInterval(interval);
  }, [fetchAirQualityData, fetchApiHealth]);

  // Compute active snapshot (either live NEA telemetry or atmospheric simulation)
  const activeSnapshot = useMemo<AirQualitySnapshot | null>(() => {
    if (!rawSnapshot) return null;
    if (weatherMode === 'simulate') {
      return applyHazeSimulation(rawSnapshot, simulatedPsi);
    }
    return rawSnapshot;
  }, [rawSnapshot, weatherMode, simulatedPsi]);

  // Handle user GPS geolocation
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setGeoStatus('error');
      setGeoFeedback('Geolocation is not supported by your browser. Select a Singapore district below.');
      return;
    }

    setGeoStatus('locating');
    setGeoFeedback('Acquiring GPS coordinates...');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        if (!activeSnapshot) return;

        // Check if user is roughly within Singapore bounding box (lat 1.15..1.50, lng 103.55..104.10)
        const isInSingapore =
          latitude >= 1.15 &&
          latitude <= 1.5 &&
          longitude >= 103.55 &&
          longitude <= 104.1;

        const { region, distanceKm } = findNearestRegion(
          latitude,
          longitude,
          activeSnapshot.regions
        );

        setSelectedRegion(region);
        setUserLocation({
          latitude: isInSingapore ? latitude : activeSnapshot.regions[region].coordinates.latitude,
          longitude: isInSingapore ? longitude : activeSnapshot.regions[region].coordinates.longitude,
          label: isInSingapore ? 'Your GPS Location' : `Nearest SG Sector (${REGION_LABELS[region].name})`,
          distanceKm: Number(distanceKm.toFixed(1)),
          nearestRegion: region,
        });
        setGeoStatus('locked');
        setGeoFeedback(
          isInSingapore
            ? `GPS locked · ${distanceKm.toFixed(1)} km from ${REGION_LABELS[region].name} station`
            : `Outside SG bounds (${distanceKm.toFixed(0)} km) · Snapped to ${REGION_LABELS[region].name}`
        );
      },
      () => {
        setGeoStatus('error');
        setGeoFeedback('Location permission declined. Choose a Singapore district or click any point on the map.');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Handle clicking any point on the interactive Singapore map
  const handleMapClickLocation = useCallback(
    (lat: number, lng: number) => {
      if (!activeSnapshot) return;
      const { region, distanceKm } = findNearestRegion(lat, lng, activeSnapshot.regions);
      setSelectedRegion(region);
      setUserLocation({
        latitude: lat,
        longitude: lng,
        label: `Probe (${lat.toFixed(3)}°N, ${lng.toFixed(3)}°E)`,
        distanceKm: Number(distanceKm.toFixed(1)),
        nearestRegion: region,
      });
      setGeoStatus('locked');
      setGeoFeedback(
        `Map probe locked · ${distanceKm.toFixed(1)} km from ${REGION_LABELS[region].name} station`
      );
    },
    [activeSnapshot]
  );

  // Handle selecting a preset Singapore neighborhood
  const handleSelectPreset = (presetName: string) => {
    const preset = SINGAPORE_PRESET_LOCATIONS.find((p) => p.name === presetName);
    if (!preset || !activeSnapshot) return;
    const { region, distanceKm } = findNearestRegion(
      preset.latitude,
      preset.longitude,
      activeSnapshot.regions
    );
    setSelectedRegion(region);
    setUserLocation({
      latitude: preset.latitude,
      longitude: preset.longitude,
      label: preset.name,
      distanceKm: Number(distanceKm.toFixed(1)),
      nearestRegion: region,
    });
    setGeoStatus('locked');
    setGeoFeedback(
      `Locked to ${preset.name} · ${distanceKm.toFixed(1)} km from ${REGION_LABELS[region].name}`
    );
  };

  // Handle OneMap Postal Code / Building Search
  const handleOneMapSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/onemap/search?searchVal=${encodeURIComponent(searchQuery.trim())}`);
      if (!res.ok) throw new Error('OneMap search failed');
      const data = await res.json();
      const results: OneMapSearchResult[] = Array.isArray(data?.results) ? data.results.slice(0, 5) : [];
      setSearchResults(results);
      if (results.length === 0) {
        setGeoFeedback(`No Singapore address or postal code matched "${searchQuery.trim()}"`);
      }
    } catch {
      setGeoFeedback('Unable to query OneMap Elastic Search right now.');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSelectOneMapResult = (item: OneMapSearchResult) => {
    if (!activeSnapshot) return;
    const lat = Number(item.LATITUDE);
    const lng = Number(item.LONGITUDE);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return;

    const { region, distanceKm } = findNearestRegion(lat, lng, activeSnapshot.regions);
    const label = item.BUILDING && item.BUILDING !== 'NIL' ? item.BUILDING : item.SEARCHVAL;
    setSelectedRegion(region);
    setUserLocation({
      latitude: lat,
      longitude: lng,
      label: `${label} (${item.POSTAL !== 'NIL' ? `S${item.POSTAL}` : item.ROAD_NAME})`,
      distanceKm: Number(distanceKm.toFixed(1)),
      nearestRegion: region,
    });
    setSearchResults([]);
    setGeoStatus('locked');
    setGeoFeedback(
      `OneMap locked: ${item.ADDRESS} · ${distanceKm.toFixed(1)} km from ${REGION_LABELS[region].name}`
    );
  };

  // Determine atmospheric haze intensity from the active region's readings
  const activeRegionReading = activeSnapshot?.regions[selectedRegion] || null;
  const activePsiBand = getPsiBand(activeRegionReading?.psi24Hr ?? 50);
  const activePm25Band = getPm25Band(activeRegionReading?.pm25OneHr ?? 20);

  // Use the higher of PSI or PM2.5 haze intensity so particles respond accurately to real-time spikes
  const effectiveHazeIntensity = Math.max(
    activePsiBand.hazeIntensity,
    activePm25Band.hazeIntensity
  );
  const effectivePsiForWeather = Math.max(
    activeRegionReading?.psi24Hr ?? 50,
    activeRegionReading?.pm25OneHr ?? 25
  );

  const formatSGT = (iso: string | null | undefined) => {
    if (!iso) return 'N/A';
    try {
      return new Intl.DateTimeFormat('en-SG', {
        timeZone: 'Asia/Singapore',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(new Date(iso)) + ' SGT';
    } catch {
      return iso;
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col transition-colors duration-1000 relative"
      style={{
        backgroundColor:
          effectiveHazeIntensity > 0.35
            ? '#0C0A08' // Dim warm obsidian when very hazy
            : '#07090E', // Crisp deep-space obsidian when clear
      }}
    >
      {/* Animated Floating Haze Particles & Dim Light Weather Effect */}
      <HazeWeatherCanvas
        intensity={effectiveHazeIntensity}
        effectivePsi={effectivePsiForWeather}
      />

      {/* Top Bar Contract: Strict 3-Zone Navigation Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-6 py-3.5 bg-[#07090E]/90 backdrop-blur-md border-b border-slate-800/90">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap"
        >
          SG Air Quality and Weather Companion
        </a>

        {/* Zone 2: 4 clean text navigation links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-400">
          <a
            href="#telemetry-workspace"
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap"
          >
            Live Map
          </a>
          <a
            href="#sector-matrix"
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap"
          >
            Regional Breakdown
          </a>
          <a
            href="#haze-weather-lab"
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap"
          >
            Haze Atmosphere
          </a>
          <a
            href="#api-health-monitor"
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap"
          >
            API Health
          </a>
        </nav>

        {/* Zone 3: 2 primary actions */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleLocateMe}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-200 bg-slate-900 border border-slate-700 rounded hover:bg-slate-800 hover:border-slate-600 transition-colors whitespace-nowrap cursor-pointer"
          >
            <LocateFixed className="w-3.5 h-3.5 text-cyan-400" />
            <span>{geoStatus === 'locating' ? 'Locating...' : 'My Location'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              fetchAirQualityData();
              fetchApiHealth();
            }}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-950 bg-cyan-400 rounded hover:bg-cyan-300 disabled:opacity-50 transition-colors whitespace-nowrap cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync NEA</span>
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main id="top" className="relative z-20 flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6 space-y-8">
        {/* Top Telemetry Status Strip */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800/80 text-xs font-mono text-slate-400">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                healthReport?.overallStatus === 'NOMINAL'
                  ? 'bg-emerald-500 ring-4 ring-emerald-500/20'
                  : healthReport?.overallStatus === 'DEGRADED'
                  ? 'bg-amber-500 ring-4 ring-amber-500/20'
                  : 'bg-rose-500 ring-4 ring-rose-500/20'
              }`}
            />
            <span className="text-slate-200 font-medium">
              {weatherMode === 'simulate'
                ? '▲ SIMULATION OVERRIDE ACTIVE'
                : healthReport?.overallStatus === 'NOMINAL'
                ? '● NEA TELEMETRY NOMINAL'
                : '◆ NEA STREAM ACTIVE'}
            </span>
            <span aria-hidden="true">·</span>
            <span>Updated {formatSGT(activeSnapshot?.updatedTimestamp)}</span>
            <span aria-hidden="true">·</span>
            <span>
              Visibility Effect:{' '}
              <strong className="text-slate-200">
                {effectiveHazeIntensity > 0.6
                  ? 'Severe Dimming & Dense Haze Plumes'
                  : effectiveHazeIntensity > 0.25
                  ? 'Dimmed Ambient Light & Floating Haze Particles'
                  : 'Clear Atmosphere (Particles Faded Out)'}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span>
              National Peak PSI:{' '}
              <strong className="text-white">{activeSnapshot?.nationalMaxPsi ?? '--'}</strong>
            </span>
            <span aria-hidden="true">/</span>
            <span>
              Peak 1-Hr PM2.5:{' '}
              <strong className="text-white">
                {activeSnapshot?.nationalMaxPm25 ?? '--'} µg/m³
              </strong>
            </span>
          </div>
        </div>

        {/* Error Alert Banner if API fails */}
        {errorMsg && (
          <div className="p-4 bg-rose-950/60 border border-rose-500/50 rounded flex items-center justify-between text-sm text-rose-200">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              type="button"
              onClick={fetchAirQualityData}
              className="px-3 py-1 text-xs font-mono bg-rose-500/20 border border-rose-500/40 rounded hover:bg-rose-500/30 whitespace-nowrap"
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* Section 1: Asymmetric Split Console (Left Control & Local Readout | Right Interactive Map) */}
        <section
          id="telemetry-workspace"
          className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch"
        >
          {/* Left Column: Location Telemetry, Primary PSI / PM2.5 Readouts & Weather Atmosphere Control (5 cols) */}
          <div className="lg:col-span-5 flex flex-col justify-between bg-[#111827]/90 border border-slate-800 rounded p-5 space-y-6">
            {/* Location Selector & Sector Header */}
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
                    <span>{REGION_LABELS[selectedRegion].sectorCode}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {userLocation && userLocation.nearestRegion === selectedRegion
                        ? `${userLocation.label} (${userLocation.distanceKm} km)`
                        : 'REGIONAL MONITORING STATION'}
                    </span>
                  </div>
                  <h1 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight mt-1">
                    {REGION_LABELS[selectedRegion].name}
                  </h1>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {REGION_LABELS[selectedRegion].hubs}
                  </p>
                </div>

                {/* Explicit Non-Hue-Only Band Status */}
                <div
                  className={`px-2.5 py-1 border rounded text-xs font-mono font-semibold whitespace-nowrap ${activePsiBand.textClass} ${activePsiBand.borderClass}`}
                  style={{ backgroundColor: activePsiBand.bgSubtle }}
                >
                  {activePsiBand.glyph} {activePsiBand.label}
                </div>
              </div>

              {/* Quick District Jump / Geolocation Bar */}
              <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <select
                    aria-label="Jump to Singapore District or Landmark"
                    value={userLocation?.label || ''}
                    onChange={(e) => handleSelectPreset(e.target.value)}
                    className="w-full bg-[#07090E] border border-slate-800 focus:border-cyan-500 rounded px-3 py-2 text-xs text-slate-200 font-mono outline-none transition-colors"
                  >
                    <option value="" disabled>
                      Select Singapore Landmark / Town...
                    </option>
                    {SINGAPORE_PRESET_LOCATIONS.map((loc) => (
                      <option key={loc.name} value={loc.name}>
                        {loc.name} ({loc.region.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 5-Region Segmented Switcher */}
                <div className="flex items-center bg-[#07090E] p-1 rounded border border-slate-800">
                  {REGIONS_LIST.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setSelectedRegion(r)}
                      className={`px-2 py-1 text-[11px] font-mono uppercase rounded transition-colors cursor-pointer whitespace-nowrap ${
                        selectedRegion === r
                          ? 'bg-cyan-500 text-slate-950 font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {r.slice(0, 1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* OneMap Postal Code / Building Search Input */}
              <div className="relative">
                <form onSubmit={handleOneMapSearch} className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="OneMap Search: SG Postal Code (e.g. 238801) or Building..."
                      className="w-full bg-[#07090E] border border-slate-800 focus:border-cyan-500 rounded pl-3 pr-8 py-1.5 text-xs text-slate-200 font-mono outline-none transition-colors"
                    />
                    {searchResults.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSearchResults([])}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-500 hover:text-slate-300"
                      >
                        ESC
                      </button>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={searchLoading}
                    className="px-3 py-1.5 bg-slate-900 border border-slate-700 hover:border-cyan-500/60 text-xs font-mono text-slate-200 rounded transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {searchLoading ? '...' : 'Find'}
                  </button>
                </form>

                {searchResults.length > 0 && (
                  <div className="absolute left-0 right-0 mt-1 z-30 bg-[#0B0E17] border border-slate-700 rounded shadow-xl divide-y divide-slate-800 max-h-48 overflow-y-auto">
                    {searchResults.map((item, idx) => (
                      <button
                        key={`${item.POSTAL}-${idx}`}
                        type="button"
                        onClick={() => handleSelectOneMapResult(item)}
                        className="w-full text-left px-3 py-2 hover:bg-slate-800/80 transition-colors flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="truncate">
                          <div className="font-medium text-white truncate">{item.SEARCHVAL}</div>
                          <div className="text-[11px] font-mono text-slate-400 truncate">
                            {item.ADDRESS}
                          </div>
                        </div>
                        {item.POSTAL && item.POSTAL !== 'NIL' && (
                          <span className="text-[10px] font-mono text-cyan-400 shrink-0">
                            S({item.POSTAL})
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {geoFeedback && (
                <div className="text-[11px] font-mono text-cyan-400 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span>{geoFeedback}</span>
                </div>
              )}
            </div>

            {/* Dual Primary Telemetry Readouts: 24-Hr PSI & 1-Hr PM2.5 */}
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-800/80">
              {/* 24-Hr PSI Metric Box */}
              <div
                onClick={() => setActiveMetric('psi')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setActiveMetric('psi')}
                className={`p-4 rounded border transition-colors cursor-pointer ${
                  activeMetric === 'psi'
                    ? 'bg-[#07090E] border-cyan-500/70'
                    : 'bg-[#07090E]/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                  <span>24-HR PSI</span>
                  <span style={{ color: activePsiBand.colorHex }}>
                    {activePsiBand.glyph} {activePsiBand.id}
                  </span>
                </div>
                <div className="mt-2 flex items-baseline">
                  <span
                    className="text-4xl font-mono font-bold tracking-tight"
                    style={{ color: activePsiBand.colorHex }}
                  >
                    {activeRegionReading ? activeRegionReading.psi24Hr : '--'}
                  </span>
                  <span className="text-xs font-mono text-slate-400 ml-1.5 uppercase">
                    INDEX
                  </span>
                </div>
                <div className="mt-2 text-[11px] font-mono text-slate-400">
                  PM2.5 Sub-Index: {activeRegionReading?.pm25SubIndex ?? '--'}
                </div>
              </div>

              {/* 1-Hr PM2.5 Concentration Metric Box */}
              <div
                onClick={() => setActiveMetric('pm25')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setActiveMetric('pm25')}
                className={`p-4 rounded border transition-colors cursor-pointer ${
                  activeMetric === 'pm25'
                    ? 'bg-[#07090E] border-cyan-500/70'
                    : 'bg-[#07090E]/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                  <span>1-HR PM2.5</span>
                  <span style={{ color: activePm25Band.colorHex }}>
                    {activePm25Band.glyph}
                  </span>
                </div>
                <div className="mt-2 flex items-baseline">
                  <span
                    className="text-4xl font-mono font-bold tracking-tight"
                    style={{ color: activePm25Band.colorHex }}
                  >
                    {activeRegionReading ? activeRegionReading.pm25OneHr : '--'}
                  </span>
                  <span className="text-xs font-mono text-slate-400 ml-1.5">
                    µg/m³
                  </span>
                </div>
                <div className="mt-2 text-[11px] font-mono text-slate-400">
                  24-Hr Avg: {activeRegionReading?.pm25TwentyFourHr ?? '--'} µg/m³
                </div>
              </div>
            </div>

            {/* Secondary Sub-Indices Strip */}
            <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-800/80 text-center">
              <div className="p-2 bg-[#07090E]/80 border border-slate-800/80 rounded">
                <div className="text-[10px] font-mono text-slate-400">24h PM10</div>
                <div className="text-sm font-mono font-semibold text-slate-200 mt-0.5">
                  {activeRegionReading?.pm10TwentyFourHr ?? '--'}
                  <span className="text-[10px] text-slate-500 ml-0.5">µg</span>
                </div>
              </div>
              <div className="p-2 bg-[#07090E]/80 border border-slate-800/80 rounded">
                <div className="text-[10px] font-mono text-slate-400">8h O₃ Max</div>
                <div className="text-sm font-mono font-semibold text-slate-200 mt-0.5">
                  {activeRegionReading?.o3EightHrMax ?? '--'}
                  <span className="text-[10px] text-slate-500 ml-0.5">µg</span>
                </div>
              </div>
              <div className="p-2 bg-[#07090E]/80 border border-slate-800/80 rounded">
                <div className="text-[10px] font-mono text-slate-400">1h NO₂</div>
                <div className="text-sm font-mono font-semibold text-slate-200 mt-0.5">
                  {activeRegionReading?.no2OneHrMax ?? '--'}
                  <span className="text-[10px] text-slate-500 ml-0.5">µg</span>
                </div>
              </div>
              <div className="p-2 bg-[#07090E]/80 border border-slate-800/80 rounded">
                <div className="text-[10px] font-mono text-slate-400">8h CO Max</div>
                <div className="text-sm font-mono font-semibold text-slate-200 mt-0.5">
                  {activeRegionReading?.coEightHrMax ?? '--'}
                  <span className="text-[10px] text-slate-500 ml-0.5">mg</span>
                </div>
              </div>
            </div>

            {/* NEA Health Advisory Box */}
            <div className="p-3.5 bg-[#07090E] border border-slate-800 rounded space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono text-slate-300">
                <span className="font-semibold">NEA Health Advisory ({activePsiBand.label})</span>
                <span className="text-slate-500">PSI {activePsiBand.psiRange}</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {activePsiBand.advisoryGeneral}
              </p>
              <p className="text-[11px] text-slate-400 leading-relaxed pt-1 border-t border-slate-800/80">
                <strong className="text-slate-300">Sensitive Groups:</strong>{' '}
                {activePsiBand.advisorySensitive}
              </p>
            </div>
          </div>

          {/* Right Column: Interactive Color-Coded Map Stage (7 cols) */}
          <div className="lg:col-span-7 flex flex-col bg-[#111827]/90 border border-slate-800 rounded overflow-hidden">
            {/* Map Stage Top Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-800 bg-[#0B0E17]">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-semibold text-slate-200">
                  SINGAPORE SECTOR TELEMETRY MAP
                </span>
                <span className="text-slate-600">·</span>
                <span className="text-xs font-mono text-slate-400">
                  {activeRegionReading
                    ? `${activeRegionReading.coordinates.latitude.toFixed(4)}°N, ${activeRegionReading.coordinates.longitude.toFixed(4)}°E`
                    : '1.3521°N, 103.8198°E'}
                </span>
              </div>

              {/* Layer Switcher: 24-Hr PSI vs 1-Hr PM2.5 */}
              <div className="flex items-center gap-1 p-1 bg-[#07090E] border border-slate-800 rounded">
                <button
                  type="button"
                  onClick={() => setActiveMetric('psi')}
                  className={`px-3 py-1 text-xs font-mono rounded transition-colors cursor-pointer whitespace-nowrap ${
                    activeMetric === 'psi'
                      ? 'bg-cyan-500 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  24-Hr PSI Map
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMetric('pm25')}
                  className={`px-3 py-1 text-xs font-mono rounded transition-colors cursor-pointer whitespace-nowrap ${
                    activeMetric === 'pm25'
                      ? 'bg-cyan-500 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  1-Hr PM2.5 Map
                </button>
              </div>
            </div>

            {/* Leaflet Map Viewport */}
            <div className="flex-1 min-h-[440px]">
              {activeSnapshot ? (
                <SingaporeAirMap
                  snapshot={activeSnapshot}
                  activeMetric={activeMetric}
                  selectedRegion={selectedRegion}
                  onSelectRegion={setSelectedRegion}
                  userCoords={userLocation}
                  onMapClickLocation={handleMapClickLocation}
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center font-mono text-xs text-slate-400">
                  Initializing Singapore sector telemetry map...
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Section 2: Weather & Haze Particle Atmosphere Calibrator + Sub-Index Radar */}
        <section
          id="haze-weather-lab"
          className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch"
        >
          {/* Weather Effect & Floating Haze Particle Controller (7 cols) */}
          <div className="lg:col-span-7 bg-[#111827]/90 border border-slate-800 rounded p-5 flex flex-col justify-between space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h2 className="font-display text-lg font-bold text-white">
                  01. Atmospheric Weather & Floating Haze Particle Engine
                </h2>
                <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                  Real-time visual rendering coupled to NEA readings. When PSI or PM2.5 enters hazy thresholds, ambient light dims and multi-layered floating haze particles drift across the viewport—fading out automatically when air quality improves.
                </p>
              </div>

              {/* Mode Toggle: Live NEA vs Simulation Test */}
              <div className="flex items-center gap-1 p-1 bg-[#07090E] border border-slate-800 rounded">
                <button
                  type="button"
                  onClick={() => setWeatherMode('live')}
                  className={`px-3 py-1.5 text-xs font-mono rounded transition-colors cursor-pointer whitespace-nowrap ${
                    weatherMode === 'live'
                      ? 'bg-emerald-500 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  ● Live NEA Weather
                </button>
                <button
                  type="button"
                  onClick={() => setWeatherMode('simulate')}
                  className={`px-3 py-1.5 text-xs font-mono rounded transition-colors cursor-pointer whitespace-nowrap ${
                    weatherMode === 'simulate'
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  ▲ Test Haze Conditions
                </button>
              </div>
            </div>

            {/* Interactive Presets & Fine Scrubber for Testing Clear vs Very Hazy */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                <span className="text-slate-300">
                  {weatherMode === 'live'
                    ? `Driven by Live ${REGION_LABELS[selectedRegion].name} Reading (PSI ${
                        activeRegionReading?.psi24Hr ?? '--'
                      } · PM2.5 ${activeRegionReading?.pm25OneHr ?? '--'} µg/m³)`
                    : `Simulated Target PSI: ${simulatedPsi} (${getPsiBand(simulatedPsi).label})`}
                </span>
                <span className="text-cyan-400">
                  Haze Opacity: {Math.round(effectiveHazeIntensity * 100)}%
                </span>
              </div>

              {/* Quick Atmospheric Condition Presets */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { label: 'Clear Sky (Fade Out)', psi: 32, desc: 'PSI 32 · 0% Haze' },
                  { label: 'Moderate Breeze', psi: 78, desc: 'PSI 78 · Light Mist' },
                  { label: 'Unhealthy Haze', psi: 145, desc: 'PSI 145 · Dim + Plumes' },
                  { label: 'Severe Haze Alert', psi: 265, desc: 'PSI 265 · Heavy Shroud' },
                ].map((preset) => {
                  const isActive =
                    weatherMode === 'simulate' &&
                    Math.abs(simulatedPsi - preset.psi) < 15;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setWeatherMode('simulate');
                        setSimulatedPsi(preset.psi);
                      }}
                      className={`p-3 rounded border text-left transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-[#07090E] border-amber-500/70 text-white'
                          : 'bg-[#07090E]/70 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-semibold whitespace-nowrap truncate">
                        {preset.label}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 mt-1">
                        {preset.desc}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Continuous PSI Calibration Slider */}
              <div className="pt-2">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1.5">
                  <span>Scrub PSI Level to Observe Particle Fade-In / Fade-Out</span>
                  <span>Range: 15 – 320 PSI</span>
                </div>
                <input
                  type="range"
                  min={15}
                  max={320}
                  value={weatherMode === 'simulate' ? simulatedPsi : effectivePsiForWeather}
                  onChange={(e) => {
                    setWeatherMode('simulate');
                    setSimulatedPsi(Number(e.target.value));
                  }}
                  aria-label="Simulate PSI Haze Level"
                  className="w-full accent-cyan-400 bg-[#07090E] h-2 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            {/* Telemetry Metrics of the Weather Engine */}
            <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-800 text-xs font-mono">
              <div>
                <span className="text-slate-400 block">ACTIVE AEROSOL PARTICLES</span>
                <span className="text-sm font-semibold text-white">
                  {effectiveHazeIntensity > 0.02
                    ? `${Math.floor(130 * Math.min(1, effectiveHazeIntensity * 1.25))} / 130`
                    : '0 (Faded Out)'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">AMBIENT DIMMING SHROUD</span>
                <span className="text-sm font-semibold text-white">
                  {Math.round(Math.max(0, Math.min(0.62, (effectiveHazeIntensity - 0.15) * 0.72)) * 100)}% Attenuated
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">OUTDOOR GUIDANCE</span>
                <span className={`text-sm font-semibold ${activePsiBand.textClass}`}>
                  {activePsiBand.glyph} {activePsiBand.id}
                </span>
              </div>
            </div>
          </div>

          {/* Right: 6-Axis Pollutant Sub-Index Radar Inspection (5 cols) */}
          <div className="lg:col-span-5 bg-[#111827]/90 border border-slate-800 rounded p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="font-display text-lg font-bold text-white">
                  02. Sector Pollutant Fingerprint
                </h2>
                <p className="text-xs text-slate-400">
                  6-channel NEA sub-index & concentration profile for{' '}
                  <strong className="text-slate-200">
                    {REGION_LABELS[selectedRegion].name}
                  </strong>
                </p>
              </div>
              <span className="text-xs font-mono text-slate-400">
                {REGION_LABELS[selectedRegion].sectorCode}
              </span>
            </div>

            <div className="my-auto py-3 flex items-center justify-center">
              {activeRegionReading ? (
                <SubIndexRadarChart
                  reading={activeRegionReading}
                  colorHex={activePsiBand.colorHex}
                />
              ) : (
                <div className="text-xs font-mono text-slate-500">Loading radar...</div>
              )}
            </div>

            <div className="text-[11px] font-mono text-slate-400 border-t border-slate-800 pt-3 flex items-center justify-between">
              <span>SO₂ 24h: {activeRegionReading?.so2TwentyFourHr ?? '--'} µg/m³</span>
              <span>·</span>
              <span>PM10 Sub-Idx: {activeRegionReading?.pm10SubIndex ?? '--'}</span>
              <span>·</span>
              <span>O₃ Sub-Idx: {activeRegionReading?.o3SubIndex ?? '--'}</span>
            </div>
          </div>
        </section>

        {/* Section 3: Complete 5-Sector Singapore Comparison Matrix */}
        <section
          id="sector-matrix"
          className="bg-[#111827]/90 border border-slate-800 rounded p-5 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3">
            <div>
              <h2 className="font-display text-lg font-bold text-white">
                03. All-Singapore Regional Telemetry Matrix
              </h2>
              <p className="text-xs text-slate-400">
                Click any Singapore region row to lock map camera and inspect detailed pollutant sub-indices.
              </p>
            </div>
            <div className="text-xs font-mono text-slate-400">
              Data Source: api-open.data.gov.sg/v2/real-time/api/psi &amp; /pm25
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] font-mono text-slate-400">
                  <th className="py-2.5 px-3">SECTOR</th>
                  <th className="py-2.5 px-3">STATUS BAND</th>
                  <th className="py-2.5 px-3 text-right">24-HR PSI</th>
                  <th className="py-2.5 px-3 text-right">1-HR PM2.5 (µg/m³)</th>
                  <th className="py-2.5 px-3 text-right">24-HR PM2.5 (µg/m³)</th>
                  <th className="py-2.5 px-3 text-right">24-HR PM10 (µg/m³)</th>
                  <th className="py-2.5 px-3 text-right">8-HR O₃ (µg/m³)</th>
                  <th className="py-2.5 px-3 text-right">1-HR NO₂ (µg/m³)</th>
                  <th className="py-2.5 px-3 text-right">8-HR CO (mg/m³)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-xs font-mono">
                {REGIONS_LIST.map((r) => {
                  const row = activeSnapshot?.regions[r];
                  if (!row) return null;
                  const band = getPsiBand(row.psi24Hr);
                  const pmBand = getPm25Band(row.pm25OneHr);
                  const isSelected = selectedRegion === r;

                  return (
                    <tr
                      key={r}
                      onClick={() => setSelectedRegion(r)}
                      className={`transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-cyan-950/30 text-white'
                          : 'text-slate-300 hover:bg-slate-900/70'
                      }`}
                    >
                      <td className="py-3 px-3 font-sans">
                        <div className="font-semibold text-white flex items-center gap-2">
                          <span>{REGION_LABELS[r].name}</span>
                          {isSelected && (
                            <span className="text-[10px] font-mono text-cyan-400">
                              [ACTIVE]
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {REGION_LABELS[r].hubs}
                        </div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span style={{ color: band.colorHex }} className="font-semibold">
                          {band.glyph} {band.label}
                        </span>
                      </td>
                      <td
                        className="py-3 px-3 text-right font-bold text-sm"
                        style={{ color: band.colorHex }}
                      >
                        {row.psi24Hr}
                      </td>
                      <td
                        className="py-3 px-3 text-right font-bold text-sm"
                        style={{ color: pmBand.colorHex }}
                      >
                        {row.pm25OneHr}
                      </td>
                      <td className="py-3 px-3 text-right">{row.pm25TwentyFourHr}</td>
                      <td className="py-3 px-3 text-right">{row.pm10TwentyFourHr}</td>
                      <td className="py-3 px-3 text-right">{row.o3EightHrMax}</td>
                      <td className="py-3 px-3 text-right">{row.no2OneHrMax}</td>
                      <td className="py-3 px-3 text-right">{row.coEightHrMax.toFixed(1)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 4: /api/health.js Live Endpoint Diagnostic Monitor */}
        <section
          id="api-health-monitor"
          className="bg-[#111827]/90 border border-slate-800 rounded p-5 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-3">
            <div>
              <h2 className="font-display text-lg font-bold text-white">
                04. NEA Open Data API Health Monitor (/api/health.js)
              </h2>
              <p className="text-xs text-slate-400">
                Live server-side diagnostic probe verifying connectivity, HTTP status, payload schema integrity, and round-trip latency for Singapore data.gov.sg v2 endpoints.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <a
                href="/api/health.js"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 text-xs font-mono text-slate-300 bg-[#07090E] border border-slate-700 rounded hover:border-slate-500 transition-colors whitespace-nowrap"
              >
                View Raw /api/health.js JSON ↗
              </a>
              <button
                type="button"
                onClick={fetchApiHealth}
                disabled={healthLoading}
                className="px-3 py-1.5 text-xs font-mono text-slate-950 bg-cyan-400 rounded hover:bg-cyan-300 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
              >
                {healthLoading ? 'Probing...' : 'Run Health Probe'}
              </button>
            </div>
          </div>

          {healthReport ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
              {/* Overall Health Summary Card */}
              <div className="p-4 bg-[#07090E] border border-slate-800 rounded flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">OVERALL TELEMETRY HEALTH</span>
                  <span
                    className={
                      healthReport.overallStatus === 'NOMINAL'
                        ? 'text-emerald-400 font-bold'
                        : healthReport.overallStatus === 'DEGRADED'
                        ? 'text-amber-400 font-bold'
                        : 'text-rose-400 font-bold'
                    }
                  >
                    {healthReport.overallStatus === 'NOMINAL'
                      ? '● NOMINAL'
                      : healthReport.overallStatus === 'DEGRADED'
                      ? '▲ DEGRADED'
                      : '✖ CRITICAL'}
                  </span>
                </div>
                <div className="text-2xl font-bold text-white">
                  {healthReport.averageLatencyMs}{' '}
                  <span className="text-xs font-normal text-slate-400">ms avg RTT</span>
                </div>
                <div className="text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
                  Last Probe: {formatSGT(healthReport.checkedAt)}
                </div>
              </div>

              {/* Endpoint 1: PSI API Probe */}
              {[healthReport.services.psi, healthReport.services.pm25].map((srv) => (
                <div
                  key={srv.endpoint}
                  className="p-4 bg-[#07090E] border border-slate-800 rounded flex flex-col justify-between space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-white truncate">{srv.name}</span>
                    <span
                      className={
                        srv.status === 'NOMINAL'
                          ? 'text-emerald-400 font-semibold shrink-0'
                          : srv.status === 'DEGRADED'
                          ? 'text-amber-400 font-semibold shrink-0'
                          : 'text-rose-400 font-semibold shrink-0'
                      }
                    >
                      {srv.status === 'NOMINAL'
                        ? '● 200 OK'
                        : srv.status === 'DEGRADED'
                        ? `▲ HTTP ${srv.httpStatus}`
                        : '✖ OFFLINE'}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-400 break-all">{srv.endpoint}</div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-[11px]">
                    <div>
                      <span className="text-slate-500">Latency: </span>
                      <span className="text-slate-200">{srv.latencyMs} ms</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Sectors: </span>
                      <span className="text-slate-200">{srv.regionsCount ?? 5} active</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs font-mono text-slate-400 py-4">
              Running initial diagnostic probe on /api/health.js...
            </div>
          )}

          {/* OneMap Vercel Environment Variable Status Bar */}
          <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-semibold text-white">
                <KeyRound className="w-3.5 h-3.5 text-cyan-400" />
                <span>SLA OneMap Token Integration (/api/onemap.js)</span>
              </div>
              <p className="text-[11px] font-sans text-slate-400">
                Reads <code className="font-mono text-slate-200">ONEMAP_TOKEN</code> (or auto-mints a 3-day token via <code className="font-mono text-slate-200">ONEMAP_EMAIL</code> &amp; <code className="font-mono text-slate-200">ONEMAP_PASSWORD</code>) from Vercel Environment Variables.
              </p>
            </div>

            <div className="flex items-center gap-3 bg-[#07090E] border border-slate-800 px-3.5 py-2 rounded">
              <span className="text-slate-400">Token Status:</span>
              {healthReport?.onemap?.tokenCached ? (
                <span className="text-emerald-400 font-semibold">
                  ● ACTIVE ({healthReport.onemap.source || 'Vercel Env'})
                </span>
              ) : healthReport?.onemap?.configured ? (
                <span className="text-cyan-400 font-semibold">
                  ◆ CREDENTIALS CONFIGURED
                </span>
              ) : (
                <span className="text-slate-300">
                  ○ AWAITING VERCEL ENV (<code className="text-cyan-400">ONEMAP_TOKEN</code>)
                </span>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Editorial Footer */}
      <footer className="relative z-20 border-t border-slate-800/80 bg-[#07090E] px-6 py-4 text-xs text-slate-500">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <div>
            SG Air Quality and Weather Companion · Powered by Singapore National Environment Agency (NEA) Open Data APIs
          </div>
          <div className="flex items-center gap-4 font-mono">
            <a
              href="/api/health.js"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-300 transition-colors"
            >
              /api/health.js
            </a>
            <span>·</span>
            <a
              href="https://data.gov.sg"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-300 transition-colors"
            >
              data.gov.sg
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
