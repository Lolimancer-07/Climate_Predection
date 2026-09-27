import { useRef, useEffect } from 'react'
import maplibregl from 'maplibre-gl'
import type { WardRisk } from '../api/client'

interface Props {
  ward: WardRisk | null
  onWardSelect: (wardId: string) => void
}

// Fani landfall region bounds
const PURI_BOUNDS: [number, number, number, number] = [85.6, 19.5, 86.1, 20.0]

export default function MapView({ ward, onWardSelect }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<maplibregl.Map | null>(null)

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return

    const map = new maplibregl.Map({
      container: mapRef.current,
      style: {
        version: 8,
        sources: {
          'carto-dark': {
            type: 'raster',
            tiles: [
              'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
            ],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap &copy; CARTO',
          },
        },
        layers: [
          { id: 'carto-dark', type: 'raster', source: 'carto-dark' },
        ],
      },
      center: [85.85, 19.78],
      zoom: 10,
    })

    map.addControl(new maplibregl.NavigationControl(), 'top-right')

    map.on('load', () => {
      // ── Surge inundation polygon ────────────────────────────
      map.addSource('surge-inundation', {
        type: 'geojson',
        data: buildSurgePolygon(19.5, 85.9, ward?.surge_height_m ?? 2.4),
      })

      map.addLayer({
        id: 'surge-fill',
        type: 'fill',
        source: 'surge-inundation',
        paint: {
          'fill-color': '#ef4444',
          'fill-opacity': 0.28,
        },
      })

      map.addLayer({
        id: 'surge-outline',
        type: 'line',
        source: 'surge-inundation',
        paint: {
          'line-color': '#ef4444',
          'line-width': 2,
          'line-dasharray': [3, 2],
          'line-opacity': 0.8,
        },
      })

      // ── Rainfall risk zone ──────────────────────────────────
      map.addSource('rainfall-zone', {
        type: 'geojson',
        data: buildRainfallPolygon(19.78, 85.83),
      })

      map.addLayer({
        id: 'rainfall-fill',
        type: 'fill',
        source: 'rainfall-zone',
        paint: {
          'fill-color': '#f97316',
          'fill-opacity': 0.18,
        },
      })

      // ── Infrastructure markers ──────────────────────────────
      addMarker(map, [85.82, 19.78], '🏠', 'Shelter #3 — CRITICAL', 'shelter')
      addMarker(map, [85.85, 19.80], '🏠', 'Puri Govt School Shelter', 'shelter')
      addMarker(map, [85.83, 19.81], '🏥', 'DHH Puri — CRITICAL', 'hospital')
      addMarker(map, [85.81, 19.79], '⚡', 'TPCODL Substation', 'substation')

      // ── Cyclone track ───────────────────────────────────────
      map.addSource('cyclone-track', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [
              [87.5, 10.5], [86.0, 12.0], [85.2, 14.5], [85.9, 19.5],
            ],
          },
        },
      })

      map.addLayer({
        id: 'track-line',
        type: 'line',
        source: 'cyclone-track',
        paint: {
          'line-color': '#38bdf8',
          'line-width': 2,
          'line-dasharray': [5, 3],
          'line-opacity': 0.7,
        },
      })

      // Landfall point
      new maplibregl.Marker({ color: '#38bdf8' })
        .setLngLat([85.9, 19.5])
        .setPopup(new maplibregl.Popup().setText('Cyclone Fani — Landfall Point'))
        .addTo(map)
    })

    mapInstance.current = map
    return () => map.remove()
  }, [])

  // Update surge polygon when ward data changes
  useEffect(() => {
    const map = mapInstance.current
    if (!map || !ward || !map.isStyleLoaded()) return
    const source = map.getSource('surge-inundation') as maplibregl.GeoJSONSource | undefined
    if (source) {
      source.setData(buildSurgePolygon(19.5, 85.9, ward.surge_height_m))
    }
  }, [ward?.surge_height_m])

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} id="map-canvas" />

      {/* ── Legend overlay ─────────────────────── */}
      <div className="map-legend">
        <div className="panel-label" style={{ marginBottom: 8 }}>Map Legend</div>
        <div className="legend-item">
          <div className="legend-color" style={{ background: 'rgba(239,68,68,0.5)', border: '2px dashed #ef4444' }} />
          <span>Storm Surge Zone</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ background: 'rgba(249,115,22,0.4)' }} />
          <span>Rainfall Flood Risk</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ background: '#38bdf8', borderRadius: '50%' }} />
          <span>Cyclone Track</span>
        </div>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildSurgePolygon(centerLat: number, centerLon: number, surgeHeight: number) {
  const r = surgeHeight * 0.04  // rough degree radius
  const pts = 48
  const coords = Array.from({ length: pts }, (_, i) => {
    const angle = (i / pts) * 2 * Math.PI
    return [centerLon + r * 0.7 * Math.sin(angle), centerLat + r * Math.cos(angle)]
  })
  coords.push(coords[0])
  return {
    type: 'Feature' as const,
    properties: { surgeHeight },
    geometry: { type: 'Polygon' as const, coordinates: [coords] },
  }
}

function buildRainfallPolygon(lat: number, lon: number) {
  const r = 0.06
  const pts = 32
  const coords = Array.from({ length: pts }, (_, i) => {
    const angle = (i / pts) * 2 * Math.PI
    return [lon + r * Math.sin(angle), lat + r * 0.8 * Math.cos(angle)]
  })
  coords.push(coords[0])
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'Polygon' as const, coordinates: [coords] },
  }
}

function addMarker(
  map: maplibregl.Map,
  lngLat: [number, number],
  emoji: string,
  label: string,
  type: string,
) {
  const el = document.createElement('div')
  el.style.cssText = `
    width: 28px; height: 28px; border-radius: 50%;
    background: rgba(13,21,40,0.9); border: 2px solid rgba(255,255,255,0.2);
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; cursor: pointer;
    box-shadow: 0 0 12px rgba(56,189,248,0.3);
  `
  el.textContent = emoji
  el.title = label

  new maplibregl.Marker({ element: el })
    .setLngLat(lngLat)
    .setPopup(
      new maplibregl.Popup({ offset: 15 }).setHTML(
        `<div style="font-family:Inter,sans-serif;font-size:12px;color:#e2e8f0;background:#0d1528;padding:6px 10px;border-radius:6px">
          ${emoji} <strong>${label}</strong>
        </div>`
      )
    )
    .addTo(map)
}
