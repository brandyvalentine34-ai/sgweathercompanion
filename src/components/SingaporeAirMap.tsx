import React, { useEffect } from 'react';
import {
  MapContainer,
  TileLayer,
  Circle,
  CircleMarker,
  Popup,
  Tooltip,
  useMap,
} from 'react-leaflet';
import {
  AirQualitySnapshot,
  RegionName,
  REGIONS_LIST,
  REGION_LABELS,
  getPsiBand,
  getPm25Band,
} from '../types/airQuality';

interface SingaporeAirMapProps {
  snapshot: AirQualitySnapshot;
  activeMetric: 'psi' | 'pm25';
  selectedRegion: RegionName;
  onSelectRegion: (region: RegionName) => void;
  userCoords: { latitude: number; longitude: number; label: string } | null;
  onMapClickLocation: (lat: number, lng: number) => void;
}

const MapController: React.FC<{
  selectedRegion: RegionName;
  snapshot: AirQualitySnapshot;
  userCoords: { latitude: number; longitude: number } | null;
  onMapClickLocation: (lat: number, lng: number) => void;
}> = ({ selectedRegion, snapshot, onMapClickLocation }) => {
  const map = useMap();

  useEffect(() => {
    const regionData = snapshot.regions[selectedRegion];
    if (regionData) {
      map.flyTo(
        [regionData.coordinates.latitude, regionData.coordinates.longitude],
        11.5,
        { duration: 0.8 }
      );
    }
  }, [selectedRegion, map, snapshot]);

  useEffect(() => {
    const handleClick = (e: any) => {
      if (e?.latlng) {
        onMapClickLocation(e.latlng.lat, e.latlng.lng);
      }
    };
    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [map, onMapClickLocation]);

  return null;
};

export const SingaporeAirMap: React.FC<SingaporeAirMapProps> = ({
  snapshot,
  activeMetric,
  selectedRegion,
  onSelectRegion,
  userCoords,
  onMapClickLocation,
}) => {
  const sgCenter: [number, number] = [1.3521, 103.8198];
  const [basemapStyle, setBasemapStyle] = React.useState<'onemap' | 'carto'>('onemap');

  return (
    <div className="relative h-full w-full min-h-[420px] bg-[#07090E] overflow-hidden select-none">
      <MapContainer
        center={sgCenter}
        zoom={11}
        minZoom={10}
        maxZoom={18}
        scrollWheelZoom={true}
        zoomControl={false}
        className="h-full w-full z-10 cursor-crosshair"
      >
        {/* Official Singapore SLA OneMap Night Basemap or CARTO Dark Matter */}
        {basemapStyle === 'onemap' ? (
          <TileLayer
            attribution='&copy; <a href="https://www.onemap.gov.sg">Singapore Land Authority (OneMap)</a> · NEA SG'
            url="https://www.onemap.gov.sg/maps/tiles/Night/{z}/{x}/{y}.png"
          />
        ) : (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a> · NEA SG'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
        )}

        <MapController
          selectedRegion={selectedRegion}
          snapshot={snapshot}
          userCoords={userCoords}
          onMapClickLocation={onMapClickLocation}
        />

        {/* Render each of the 5 NEA Singapore sectors with color-coded coverage zones and telemetry beacons */}
        {REGIONS_LIST.map((r) => {
          const reading = snapshot.regions[r];
          if (!reading) return null;

          const value = activeMetric === 'psi' ? reading.psi24Hr : reading.pm25OneHr;
          const band = activeMetric === 'psi' ? getPsiBand(value) : getPm25Band(value);
          const isSelected = selectedRegion === r;
          const meta = REGION_LABELS[r];

          return (
            <React.Fragment key={r}>
              {/* Outer Regional Atmospheric Plume / Sector Coverage */}
              <Circle
                center={[reading.coordinates.latitude, reading.coordinates.longitude]}
                radius={5400}
                pathOptions={{
                  color: band.colorHex,
                  weight: isSelected ? 2 : 1,
                  dashArray: isSelected ? undefined : '4 6',
                  fillColor: band.colorHex,
                  fillOpacity: isSelected ? 0.24 : 0.13,
                }}
                eventHandlers={{
                  click: (e) => {
                    e.originalEvent.stopPropagation();
                    onSelectRegion(r);
                  },
                }}
              />

              {/* Inner Station Telemetry Node */}
              <CircleMarker
                center={[reading.coordinates.latitude, reading.coordinates.longitude]}
                radius={isSelected ? 18 : 14}
                pathOptions={{
                  color: '#07090E',
                  weight: 2,
                  fillColor: band.colorHex,
                  fillOpacity: 0.95,
                }}
                eventHandlers={{
                  click: (e) => {
                    e.originalEvent.stopPropagation();
                    onSelectRegion(r);
                  },
                }}
              >
                <Tooltip
                  permanent
                  direction="top"
                  offset={[0, -14]}
                  className="!bg-[#0B0E17]/95 !border !border-slate-700/80 !text-slate-100 !rounded !px-2 !py-1 !shadow-lg"
                >
                  <div className="flex items-center gap-1.5 font-mono text-xs whitespace-nowrap">
                    <span style={{ color: band.colorHex }} className="font-bold">
                      {band.glyph}
                    </span>
                    <span className="font-semibold uppercase tracking-wider text-slate-300">
                      {r}
                    </span>
                    <span className="text-slate-500">·</span>
                    <span className="font-bold text-white">{value}</span>
                    <span className="text-[10px] text-slate-400">
                      {activeMetric === 'psi' ? 'PSI' : 'µg/m³'}
                    </span>
                  </div>
                </Tooltip>

                <Popup>
                  <div className="w-64 p-3.5 bg-[#0F141F] text-slate-100 font-sans">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2.5">
                      <div>
                        <div className="text-xs font-mono text-slate-400">
                          {meta.sectorCode} · {r.toUpperCase()}
                        </div>
                        <div className="text-sm font-semibold text-white">
                          {meta.name}
                        </div>
                      </div>
                      <div
                        className="text-xs font-mono font-semibold px-1.5 py-0.5 border"
                        style={{
                          color: band.colorHex,
                          borderColor: `${band.colorHex}55`,
                          backgroundColor: `${band.colorHex}15`,
                        }}
                      >
                        {band.glyph} {band.id}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 mb-2.5">
                      <div className="bg-[#07090E] border border-slate-800/90 p-2 rounded">
                        <div className="text-[10px] font-mono text-slate-400">
                          24-HR PSI
                        </div>
                        <div className="text-lg font-mono font-bold text-white">
                          {reading.psi24Hr}
                        </div>
                      </div>
                      <div className="bg-[#07090E] border border-slate-800/90 p-2 rounded">
                        <div className="text-[10px] font-mono text-slate-400">
                          1-HR PM2.5
                        </div>
                        <div className="text-lg font-mono font-bold text-white">
                          {reading.pm25OneHr}
                          <span className="text-[10px] font-normal text-slate-400 ml-1">
                            µg/m³
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1 text-xs font-mono text-slate-300 border-t border-slate-800 pt-2">
                      <div className="flex justify-between">
                        <span className="text-slate-400">24-Hr PM2.5:</span>
                        <span>{reading.pm25TwentyFourHr} µg/m³</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">24-Hr PM10:</span>
                        <span>{reading.pm10TwentyFourHr} µg/m³</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">8-Hr O₃ Max:</span>
                        <span>{reading.o3EightHrMax} µg/m³</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">1-Hr NO₂ Max:</span>
                        <span>{reading.no2OneHrMax} µg/m³</span>
                      </div>
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            </React.Fragment>
          );
        })}

        {/* User Geolocation / Pinpoint Probe Marker */}
        {userCoords && (
          <>
            <Circle
              center={[userCoords.latitude, userCoords.longitude]}
              radius={1100}
              pathOptions={{
                color: '#38BDF8',
                weight: 1.5,
                fillColor: '#38BDF8',
                fillOpacity: 0.15,
              }}
            />
            <CircleMarker
              center={[userCoords.latitude, userCoords.longitude]}
              radius={7}
              pathOptions={{
                color: '#FFFFFF',
                weight: 2,
                fillColor: '#06B6D4',
                fillOpacity: 1,
              }}
            >
              <Tooltip
                permanent
                direction="bottom"
                offset={[0, 8]}
                className="!bg-cyan-950/95 !border !border-cyan-500/60 !text-cyan-100 !rounded !px-2 !py-0.5"
              >
                <span className="font-mono text-[11px] font-medium">
                  ⊕ {userCoords.label}
                </span>
              </Tooltip>
            </CircleMarker>
          </>
        )}
      </MapContainer>

      {/* Overlay Map Legend & Coordinate HUD */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-20 flex flex-wrap items-center gap-3 bg-[#0B0E17]/90 border border-slate-800 px-3 py-2 rounded">
        <span className="text-[11px] font-mono text-slate-400">
          {activeMetric === 'psi' ? 'NEA 24-Hr PSI Scale:' : 'NEA 1-Hr PM2.5 (µg/m³):'}
        </span>
        <div className="flex items-center gap-3 text-[11px] font-mono">
          <span className="flex items-center gap-1 text-emerald-400">
            <span>●</span>
            <span>{activeMetric === 'psi' ? '0–50 Good' : '0–15 Low'}</span>
          </span>
          <span className="flex items-center gap-1 text-cyan-400">
            <span>◆</span>
            <span>{activeMetric === 'psi' ? '51–100 Mod' : '16–55 Normal'}</span>
          </span>
          <span className="flex items-center gap-1 text-amber-400">
            <span>▲</span>
            <span>{activeMetric === 'psi' ? '101–200 Unhealthy' : '56–150 Elevated'}</span>
          </span>
          <span className="flex items-center gap-1 text-orange-400">
            <span>■</span>
            <span>{activeMetric === 'psi' ? '201–300 V.Unhealthy' : '151–250 High'}</span>
          </span>
          <span className="flex items-center gap-1 text-rose-400">
            <span>✖</span>
            <span>{activeMetric === 'psi' ? '>300 Hazardous' : '>250 V.High'}</span>
          </span>
        </div>
      </div>

      {/* Top-left basemap tile switcher (SLA OneMap Night vs CARTO Dark) */}
      <div className=" absolute top-3 left-3 z-20 flex items-center gap-1 bg-[#0B0E17]/90 border border-slate-800 p-1 rounded text-[11px] font-mono">
        <button
          type="button"
          onClick={() => setBasemapStyle('onemap')}
          className={`px-2 py-0.5 rounded transition-colors cursor-pointer whitespace-nowrap ${
            basemapStyle === 'onemap'
              ? 'bg-cyan-500 text-slate-950 font-semibold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          SG OneMap Night
        </button>
        <button
          type="button"
          onClick={() => setBasemapStyle('carto')}
          className={`px-2 py-0.5 rounded transition-colors cursor-pointer whitespace-nowrap ${
            basemapStyle === 'carto'
              ? 'bg-cyan-500 text-slate-950 font-semibold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          CARTO Telemetry
        </button>
      </div>

      {/* Top-right interactive map instruction hint */}
      <div className="pointer-events-none absolute top-3 right-3 z-20 bg-[#0B0E17]/90 border border-slate-800 px-2.5 py-1.5 rounded text-[11px] font-mono text-slate-400">
        Click any map point or sector to lock telemetry
      </div>
    </div>
  );
};
