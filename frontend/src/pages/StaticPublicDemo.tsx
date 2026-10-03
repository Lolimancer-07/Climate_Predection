import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import {
  Activity,
  AlertTriangle,
  CloudRain,
  Database,
  Gauge,
  Layers,
  Map as MapIcon,
  MapPin,
  Radio,
  ShieldCheck,
  Users,
  WifiOff,
  Wind,
} from 'lucide-react'
import 'maplibre-gl/dist/maplibre-gl.css'
import './StaticPublicDemo.css'

const ESRI_ATTRIBUTION =
  'Tiles © Esri — Sources: Esri, TomTom, Garmin, FAO, NOAA, USGS, © OpenStreetMap contributors, and the GIS User Community'

function ReferenceMap() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [mapStatus, setMapStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          esri: {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
            ],
            tileSize: 256,
            attribution: ESRI_ATTRIBUTION,
          },
        },
        layers: [{ id: 'esri-street-map', type: 'raster', source: 'esri' }],
      },
      center: [85.8312, 19.8135],
      zoom: 7.2,
      minZoom: 4,
      maxZoom: 15,
      dragRotate: false,
      pitchWithRotate: false,
    })
    mapRef.current = map
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

    map.on('load', () => {
      map.addSource('illustrative-track', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: { label: 'Illustrative path — not a forecast' },
          geometry: {
            type: 'LineString',
            coordinates: [
              [88.9, 16.2],
              [87.8, 17.0],
              [86.7, 18.0],
              [85.8312, 19.8135],
            ],
          },
        },
      })
      map.addLayer({
        id: 'illustrative-track-line',
        type: 'line',
        source: 'illustrative-track',
        paint: {
          'line-color': '#0f766e',
          'line-width': 3,
          'line-dasharray': [2, 1.5],
        },
      })

      const markerElement = document.createElement('div')
      markerElement.className = 'static-demo-map-marker'
      markerElement.setAttribute('aria-label', 'Illustrative map reference point')
      new maplibregl.Marker({ element: markerElement, anchor: 'center' })
        .setLngLat([85.8312, 19.8135])
        .setPopup(
          new maplibregl.Popup({ offset: 16 }).setText(
            'Puri reference point. The dashed path is illustrative only; it is not a live storm track or forecast.',
          ),
        )
        .addTo(map)
      setMapStatus('ready')
    })

    map.on('error', (event) => {
      if (event.error) setMapStatus('error')
    })

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  return (
    <div className="static-demo-map-frame">
      <div ref={containerRef} className="static-demo-map" aria-label="Interactive Esri street map centered on Puri, Odisha" />
      <div className="static-demo-map-label">
        <span className="static-demo-map-label-icon"><Layers size={13} /></span>
        <span><strong>ESRI STREET MAP</strong><small>Real basemap · demo overlay only</small></span>
      </div>
      <div className="static-demo-map-legend">
        <span className="static-demo-line-key" />
        <span>Illustrative path — not a forecast</span>
      </div>
      <div className={`static-demo-map-status is-${mapStatus}`} aria-live="polite">
        {mapStatus === 'ready' ? 'Map tiles ready' : mapStatus === 'error' ? 'Map tiles unavailable' : 'Loading map tiles'}
      </div>
    </div>
  )
}

const metrics = [
  { label: 'Cyclone feed', value: 'OFFLINE', note: 'Backend not connected', icon: Radio, tone: 'teal' },
  { label: 'Wind / pressure', value: '—', note: 'No forecast loaded', icon: Wind, tone: 'blue' },
  { label: 'Rainfall / surge', value: '—', note: 'No observations loaded', icon: CloudRain, tone: 'violet' },
  { label: 'Population exposure', value: '—', note: 'No exposure analysis loaded', icon: Users, tone: 'amber' },
]

const sources = [
  { name: 'IBTrACS cyclone tracks', type: 'Historical reference dataset' },
  { name: 'NASA GPM IMERG', type: 'Rainfall data integration target' },
  { name: 'Copernicus DEM', type: 'Terrain data integration target' },
]

export default function StaticPublicDemo() {
  return (
    <div className="static-demo-shell">
      <header className="static-demo-topbar">
        <div className="static-demo-brand">
          <div className="static-demo-brand-mark"><Activity size={17} /></div>
          <div><strong>KAVACH</strong><span>CYCLONE OPERATIONS CONSOLE</span></div>
        </div>
        <div className="static-demo-top-context">
          <span>GCS OVERVIEW</span><span className="static-demo-separator">/</span><span>PUBLIC PREVIEW</span>
        </div>
        <div className="static-demo-top-status">
          <span className="static-demo-pill is-demo"><Layers size={12} /> STATIC DEMO</span>
          <span className="static-demo-pill is-offline"><WifiOff size={12} /> API NOT CONNECTED</span>
        </div>
      </header>

      <div className="static-demo-layout">
        <aside className="static-demo-sidebar" aria-label="Demo navigation">
          <div className="static-demo-sidebar-caption">OPERATIONS</div>
          <div className="static-demo-nav-item is-active"><Activity size={16} /><span>GCS Overview</span></div>
          <div className="static-demo-nav-item is-disabled"><MapIcon size={16} /><span>Impact Map</span><small>API required</small></div>
          <div className="static-demo-nav-item is-disabled"><Gauge size={16} /><span>Forecast &amp; Risk</span><small>API required</small></div>
          <div className="static-demo-nav-item is-disabled"><Database size={16} /><span>Data Sources</span><small>API required</small></div>

          <div className="static-demo-sidebar-note">
            <div className="static-demo-sidebar-note-icon"><ShieldCheck size={16} /></div>
            <strong>Read-only preview</strong>
            <p>No backend is deployed for this static site. It cannot dispatch alerts, trigger actions, or provide emergency guidance.</p>
          </div>
          <div className="static-demo-sidebar-footer">KAVACH · PUBLIC BUILD</div>
        </aside>

        <main className="static-demo-main">
          <div className="static-demo-page-heading">
            <div>
              <div className="static-demo-eyebrow">CYCLONE ANTICIPATORY ACTION PLATFORM</div>
              <h1>Operations overview</h1>
              <p>Reference-style command dashboard · Bay of Bengal demonstration area</p>
            </div>
            <span className="static-demo-readonly"><ShieldCheck size={13} /> READ ONLY</span>
          </div>

          <section className="static-demo-disclaimer" role="note">
            <AlertTriangle size={17} />
            <div><strong>Illustrative preview — not operational.</strong> The dashed map path is synthetic. No live cyclone, weather, population, or risk data is displayed; do not use this site for safety decisions.</div>
          </section>

          <section className="static-demo-status-strip" aria-label="System status">
            <div><span className="static-demo-status-dot" /><span className="static-demo-status-label">ENVIRONMENT</span><strong>PUBLIC STATIC BUILD</strong></div>
            <div><span className="static-demo-status-label">BACKEND</span><strong className="is-muted">NOT DEPLOYED</strong></div>
            <div><span className="static-demo-status-label">DATA MODE</span><strong className="is-teal">ILLUSTRATIVE ONLY</strong></div>
            <div><span className="static-demo-status-label">ACTIONS</span><strong className="is-muted">DISABLED</strong></div>
          </section>

          <section className="static-demo-metrics" aria-label="Data availability">
            {metrics.map(({ label, value, note, icon: Icon, tone }) => (
              <article className="static-demo-metric-card" key={label}>
                <div className={`static-demo-metric-icon tone-${tone}`}><Icon size={17} /></div>
                <div className="static-demo-metric-copy">
                  <span>{label}</span><strong>{value}</strong><small>{note}</small>
                </div>
                <span className={`static-demo-metric-state tone-${tone}`}>{value === 'OFFLINE' ? 'OFFLINE' : 'NO DATA'}</span>
              </article>
            ))}
          </section>

          <section className="static-demo-map-card">
            <div className="static-demo-section-heading">
              <div className="static-demo-section-icon"><MapIcon size={17} /></div>
              <div><h2>Coastal map</h2><p>Puri, Odisha · real street basemap with a clearly marked illustrative overlay</p></div>
              <span className="static-demo-map-location"><MapPin size={13} /> REFERENCE AREA</span>
            </div>
            <ReferenceMap />
            <div className="static-demo-map-footnote">Basemap: Esri World Street Map. Map tiles require an internet connection. Overlay is synthetic demo geometry and is not a cyclone forecast.</div>
          </section>

          <section className="static-demo-lower-grid">
            <article className="static-demo-panel">
              <div className="static-demo-panel-heading"><div className="static-demo-section-icon"><Database size={16} /></div><div><h2>Data integration targets</h2><p>Sources to connect to the live backend</p></div></div>
              <div className="static-demo-source-list">
                {sources.map((source) => (
                  <div className="static-demo-source-row" key={source.name}>
                    <div><strong>{source.name}</strong><span>{source.type}</span></div>
                    <span className="static-demo-not-configured">NOT CONNECTED</span>
                  </div>
                ))}
              </div>
            </article>
            <article className="static-demo-panel">
              <div className="static-demo-panel-heading"><div className="static-demo-section-icon"><Gauge size={16} /></div><div><h2>Operational pipeline</h2><p>Backend-dependent stages are inactive here</p></div></div>
              <div className="static-demo-pipeline">
                {['Ingest', 'Forecast', 'Exposure', 'Review'].map((step, index) => (
                  <div className="static-demo-pipeline-step" key={step}>
                    <span className="static-demo-pipeline-number">0{index + 1}</span><strong>{step}</strong><span>Not connected</span>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <footer className="static-demo-footer">Public static preview · backend and live data feeds are not hosted · no emergency advice or dispatch is provided</footer>
        </main>
      </div>
    </div>
  )
}
