import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bot,
  Camera,
  CloudRain,
  Database,
  FileCheck,
  FileText,
  Gauge,
  Globe2,
  Layers,
  Map as MapIcon,
  MapPin,
  Radio,
  Settings,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  WifiOff,
  Wind,
  X,
  Zap,
} from 'lucide-react'
import { useStorm } from '../context/StormContext'
import { AICopilotRightPanel } from '../components/AICopilotRightPanel'
import { CommandDock } from '../components/CommandDock'
import { TelemetryFdrMonitor } from '../components/TelemetryFdrMonitor'
import { NationalOverview } from './NationalOverview'
import Dashboard from './Dashboard'
import { OperationsOverview } from './OperationsOverview'
import { LiveStormTracker } from './LiveStormTracker'
import { ModelEvidencePage } from './ModelEvidencePage'
import { ScenarioLabPage } from './ScenarioLabPage'
import { AdvisoryReviewPage } from './AdvisoryReviewPage'
import { InsurerDashboard } from './InsurerDashboard'
import { HardeningPriorityPage } from './HardeningPriorityPage'
import { DamageAssessmentPage } from './DamageAssessmentPage'
import { HistoricalTrendsPage } from './HistoricalTrendsPage'
import AdminPanel from './AdminPanel'
import 'maplibre-gl/dist/maplibre-gl.css'
import './StaticPublicDemo.css'

const ESRI_ATTRIBUTION =
  'Tiles © Esri — Sources: Esri, TomTom, Garmin, FAO, NOAA, USGS, © OpenStreetMap contributors, and the GIS User Community'

type PublicView =
  | 'home'
  | 'national_overview'
  | 'overview'
  | 'live_tracker'
  | 'dashboard'
  | 'telemetry_fdr'
  | 'model_evidence'
  | 'scenario_lab'
  | 'advisories'
  | 'insurance'
  | 'hardening'
  | 'damage'
  | 'trends'
  | 'admin'
  | 'data_sources'

type NavEntry = { id: PublicView; label: string; title: string; description: string; icon: typeof Activity }
type NavGroup = { label: string; items: NavEntry[] }

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Operations',
    items: [
      { id: 'home', label: 'GCS Overview', title: 'Operations overview', description: 'Read-only system state and real basemap preview.', icon: Activity },
      { id: 'national_overview', label: 'National Multi-Hazard', title: 'National multi-hazard', description: 'Portfolio-level cyclone monitoring and event overview.', icon: Globe2 },
      { id: 'overview', label: 'District Digital Twin', title: 'District digital twin', description: 'Risk indicators, digital-twin modules, and sample telemetry.', icon: Gauge },
      { id: 'live_tracker', label: 'Live Storm Tracker', title: 'Storm tracker', description: 'Storm selection, track layers, and risk timeline interface.', icon: Radio },
      { id: 'dashboard', label: 'Impact Map & Inundation', title: 'Impact map & inundation', description: 'Map layers, exposure analysis, and impact controls.', icon: MapIcon },
      { id: 'telemetry_fdr', label: 'Telemetry FDR & Sniffer', title: 'Telemetry FDR & sniffer', description: 'Telemetry frames, event inspection, and recorder diagnostics.', icon: Database },
    ],
  },
  {
    label: 'Actions & Response',
    items: [
      { id: 'advisories', label: 'Advisories & HITL Review', title: 'Advisories & HITL review', description: 'Advisory review workflow preview; dispatch is unavailable here.', icon: FileText },
      { id: 'insurance', label: 'Parametric Triggers', title: 'Parametric triggers', description: 'Insurance trigger evaluation and audit interface preview.', icon: Zap },
      { id: 'hardening', label: 'Assets & Hardening', title: 'Assets & hardening', description: 'Asset-priority and structural hardening workflow preview.', icon: Shield },
      { id: 'damage', label: 'After-Action Damage', title: 'After-action damage', description: 'Damage-assessment workflow and evidence interface preview.', icon: Camera },
    ],
  },
  {
    label: 'Intelligence & System',
    items: [
      { id: 'model_evidence', label: 'Model Evidence & Proof', title: 'Model evidence & proof', description: 'Model provenance, evidence, and verification interface.', icon: FileCheck },
      { id: 'scenario_lab', label: 'Scenario Lab (What-If)', title: 'Scenario lab (what-if)', description: 'Scenario parameters and comparison workflow preview.', icon: SlidersHorizontal },
      { id: 'trends', label: 'Historical Backtests', title: 'Historical backtests', description: 'Historical-event analysis and backtesting interface preview.', icon: BarChart3 },
      { id: 'admin', label: 'Administration & RBAC', title: 'Administration & RBAC', description: 'Administration screens are shown for interface preview only.', icon: Settings },
      { id: 'data_sources', label: 'Data Sources & Pipeline', title: 'Data sources & pipeline', description: 'Integration targets and the current public-site boundary.', icon: CloudRain },
    ],
  },
]

const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items)
const SOURCES = [
  { name: 'IBTrACS cyclone tracks', type: 'Historical reference dataset' },
  { name: 'NASA GPM IMERG', type: 'Rainfall data integration target' },
  { name: 'Copernicus DEM', type: 'Terrain data integration target' },
]

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
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}'],
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
            coordinates: [[88.9, 16.2], [87.8, 17.0], [86.7, 18.0], [85.8312, 19.8135]],
          },
        },
      })
      map.addLayer({
        id: 'illustrative-track-line',
        type: 'line',
        source: 'illustrative-track',
        paint: { 'line-color': '#0f766e', 'line-width': 3, 'line-dasharray': [2, 1.5] },
      })

      const markerElement = document.createElement('div')
      markerElement.className = 'static-demo-map-marker'
      markerElement.setAttribute('aria-label', 'Illustrative map reference point')
      new maplibregl.Marker({ element: markerElement, anchor: 'center' })
        .setLngLat([85.8312, 19.8135])
        .setPopup(new maplibregl.Popup({ offset: 16 }).setText(
          'Puri reference point. The dashed path is illustrative only; it is not a live storm track or forecast.',
        ))
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
      <div className="static-demo-map-legend"><span className="static-demo-line-key" /><span>Illustrative path — not a forecast</span></div>
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

function DataSourcesFeature() {
  return (
    <div className="static-demo-lower-grid">
      <article className="static-demo-panel">
        <div className="static-demo-panel-heading"><div className="static-demo-section-icon"><Database size={16} /></div><div><h2>Data integration targets</h2><p>Sources to connect to the live backend</p></div></div>
        <div className="static-demo-source-list">
          {SOURCES.map((source) => (
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
    </div>
  )
}

function FeaturePage({ view, onNavigate }: { view: PublicView; onNavigate: (page: PublicView) => void }) {
  switch (view) {
    case 'national_overview':
      return <NationalOverview onNavigateToStorm={() => onNavigate('live_tracker')} onNavigateToDistrict={() => onNavigate('dashboard')} />
    case 'overview':
      return <OperationsOverview onNavigate={(page) => onNavigate(page as PublicView)} />
    case 'live_tracker':
      return <LiveStormTracker onNavigateToDashboard={() => onNavigate('dashboard')} />
    case 'dashboard':
      return <Dashboard />
    case 'telemetry_fdr':
      return <div className="static-demo-feature-padding"><TelemetryFdrMonitor /></div>
    case 'model_evidence':
      return <ModelEvidencePage />
    case 'scenario_lab':
      return <ScenarioLabPage />
    case 'advisories':
      return <AdvisoryReviewPage />
    case 'insurance':
      return <InsurerDashboard />
    case 'hardening':
      return <HardeningPriorityPage />
    case 'damage':
      return <DamageAssessmentPage />
    case 'trends':
      return <HistoricalTrendsPage />
    case 'admin':
      return <AdminPanel />
    case 'data_sources':
      return <DataSourcesFeature />
    default:
      return null
  }
}

export default function StaticPublicDemo() {
  const [activeView, setActiveView] = useState<PublicView>('home')
  const [commandDockOpen, setCommandDockOpen] = useState(false)
  const { isCopilotOpen, setIsCopilotOpen } = useStorm()
  const activeItem = ALL_NAV_ITEMS.find((item) => item.id === activeView) ?? ALL_NAV_ITEMS[0]
  const navigate = (page: PublicView) => setActiveView(page)

  return (
    <div className="static-demo-shell">
      <header className="static-demo-topbar">
        <div className="static-demo-brand">
          <div className="static-demo-brand-mark"><Activity size={17} /></div>
          <div><strong>KAVACH</strong><span>CYCLONE OPERATIONS CONSOLE</span></div>
        </div>
        <div className="static-demo-top-context">
          <span>{activeItem.label.toUpperCase()}</span><span className="static-demo-separator">/</span><span>PUBLIC PREVIEW</span>
        </div>
        <div className="static-demo-top-status">
          <span className="static-demo-pill is-demo"><Layers size={12} /> STATIC DEMO</span>
          <span className="static-demo-pill is-offline"><WifiOff size={12} /> API NOT CONNECTED</span>
          <button className="static-demo-tool-button" onClick={() => setCommandDockOpen((open) => !open)} title="Open mission and simulation controls">
            <SlidersHorizontal size={13} /><span>TOOLS</span>
          </button>
          <button className={`static-demo-tool-button ${isCopilotOpen ? 'is-selected' : ''}`} onClick={() => setIsCopilotOpen(!isCopilotOpen)} title="Open the offline Copilot preview">
            <Bot size={13} /><span>NEXUS</span>
          </button>
        </div>
      </header>

      <div className="static-demo-layout">
        <aside className="static-demo-sidebar" aria-label="Operations navigation">
          {NAV_GROUPS.map((group) => (
            <section className="static-demo-nav-group" key={group.label}>
              <div className="static-demo-sidebar-caption">{group.label}</div>
              {group.items.map(({ id, label, icon: Icon }) => (
                <button
                  className={`static-demo-nav-item ${activeView === id ? 'is-active' : ''}`}
                  key={id}
                  onClick={() => navigate(id)}
                  aria-current={activeView === id ? 'page' : undefined}
                >
                  <Icon size={16} /><span>{label}</span>
                </button>
              ))}
            </section>
          ))}
          <div className="static-demo-sidebar-note">
            <div className="static-demo-sidebar-note-icon"><ShieldCheck size={16} /></div>
            <strong>Read-only preview</strong>
            <p>All screens are available for interface review. No live API, AI, WebSocket, dispatch, or insurance action is enabled.</p>
          </div>
          <div className="static-demo-sidebar-footer">KAVACH · PUBLIC BUILD</div>
        </aside>

        <div className="static-demo-mobile-nav" aria-label="Mobile operations navigation">
          {ALL_NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button key={id} className={activeView === id ? 'is-active' : ''} onClick={() => navigate(id)}>
              <Icon size={14} /><span>{label}</span>
            </button>
          ))}
        </div>

        <main className="static-demo-main">
          {activeView === 'home' ? (
            <>
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
                <div><strong>Illustrative preview — not operational.</strong> The dashed map path and any sample figures in feature pages are synthetic. No live cyclone, weather, population, or risk data is guaranteed; do not use this site for safety or financial decisions.</div>
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
                    <div className="static-demo-metric-copy"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>
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

              <DataSourcesFeature />
              <footer className="static-demo-footer">Public static preview · backend and live data feeds are not hosted · no emergency advice or dispatch is provided</footer>
            </>
          ) : (
            <>
              <div className="static-demo-page-heading">
                <div>
                  <div className="static-demo-eyebrow">KAVACH · FEATURE PREVIEW</div>
                  <h1>{activeItem.title}</h1>
                  <p>{activeItem.description}</p>
                </div>
                <span className="static-demo-readonly"><ShieldCheck size={13} /> PREVIEW ONLY</span>
              </div>
              <section className="static-demo-disclaimer" role="note">
                <AlertTriangle size={17} />
                <div><strong>Backend unavailable in this public build.</strong> Controls that need live services are blocked; displayed examples are illustrative only and must not be used for operational, safety, or financial decisions.</div>
              </section>
              <div className="static-demo-feature-workspace">
                <FeaturePage view={activeView} onNavigate={navigate} />
              </div>
            </>
          )}
        </main>
      </div>

      {commandDockOpen && (
        <div className="static-demo-tools-overlay" role="dialog" aria-modal="true" aria-label="Mission simulation controls">
          <div className="static-demo-tools-heading"><div><strong>Mission &amp; simulation controls</strong><span>Local interface preview · no backend actions</span></div><button onClick={() => setCommandDockOpen(false)} aria-label="Close mission controls"><X size={17} /></button></div>
          <CommandDock />
        </div>
      )}
      <AICopilotRightPanel />
    </div>
  )
}
