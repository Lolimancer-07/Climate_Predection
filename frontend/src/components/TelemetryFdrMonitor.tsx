/**
 * frontend/src/components/TelemetryFdrMonitor.tsx
 *
 * Meteorological Ingestion & Cyclone Telemetry Packet FDR (Flight Data Recorder).
 * Replaces CAN bus sniffer with an interactive WMO SYNOP / AWS / INSAT-3DR
 * telemetry sniffer with bit/byte breakdown and CSV/JSON export.
 */
import React, { useState, useMemo } from 'react';
import {
  Activity,
  ChevronDown,
  ChevronRight,
  Cpu,
  Download,
  Filter,
  Radio,
  Search,
} from 'lucide-react';

interface TelemetryPacket {
  cycle: number;
  timestamp: string;
  station_id: string;
  source_type: string;
  message_name: string;
  raw_hex: string;
  decoded: string;
  fields: {
    param_id: string;
    name: string;
    bit_range: string;
    res: string;
    val: string | number;
    unit: string;
  }[];
}

const SAMPLE_PACKETS: TelemetryPacket[] = [
  {
    cycle: 104,
    timestamp: '2026-09-28T22:30:00Z',
    station_id: 'AWS-OD-PURI-01',
    source_type: 'WMO SYNOP',
    message_name: 'MET_SURFACE_SYNOP',
    raw_hex: 'AA 03 A4 00 00 D7 08 5E',
    decoded: 'Puri Coastal AWS: 932.4 hPa, 215.2 km/h Wind, 38.4 mm/h Rain',
    fields: [
      { param_id: 'PARAM-01', name: 'Barometric Pressure QNH', bit_range: '0..15', res: '0.1 hPa', val: 932.4, unit: 'hPa' },
      { param_id: 'PARAM-02', name: 'Sustained Wind Speed 10m', bit_range: '16..27', res: '0.1 km/h', val: 215.2, unit: 'km/h' },
      { param_id: 'PARAM-03', name: 'Peak Anemometer Gust', bit_range: '28..39', res: '0.1 km/h', val: 245.8, unit: 'km/h' },
      { param_id: 'PARAM-04', name: 'Precipitation Intensity', bit_range: '40..51', res: '0.1 mm/h', val: 38.4, unit: 'mm/h' },
      { param_id: 'PARAM-05', name: 'Ambient Dew Point Temp', bit_range: '52..63', res: '0.1 °C', val: 26.8, unit: '°C' },
    ],
  },
  {
    cycle: 103,
    timestamp: '2026-09-28T22:29:50Z',
    station_id: 'BUOY-BOB-BD08',
    source_type: 'INCOIS MOORED',
    message_name: 'HYDRO_BUOY_METOCEAN',
    raw_hex: '04 1E B8 02 01 F4 00 2A',
    decoded: 'Bay of Bengal Buoy BD08: Surge Height +4.2m, Wave Period 12.4s',
    fields: [
      { param_id: 'PARAM-11', name: 'Significant Wave Height (Hs)', bit_range: '0..15', res: '0.01 m', val: 5.8, unit: 'm' },
      { param_id: 'PARAM-12', name: 'Storm Surge Elevation', bit_range: '16..31', res: '0.01 m', val: 4.2, unit: 'm' },
      { param_id: 'PARAM-13', name: 'Dominant Wave Period (Tp)', bit_range: '32..47', res: '0.1 s', val: 12.4, unit: 's' },
      { param_id: 'PARAM-14', name: 'Sea Surface Temperature', bit_range: '48..63', res: '0.01 °C', val: 30.2, unit: '°C' },
    ],
  },
  {
    cycle: 102,
    timestamp: '2026-09-28T22:29:40Z',
    station_id: 'RADAR-PARADIP-DWR',
    source_type: 'DWR S-BAND',
    message_name: 'DWR_REFLECTIVITY_RADIAL',
    raw_hex: 'FF 34 2C 12 8A 00 4B 91',
    decoded: 'Paradip Doppler Radar: Max Reflectivity 54 dBZ (Eyewall Swath)',
    fields: [
      { param_id: 'PARAM-21', name: 'Max Eyewall Reflectivity', bit_range: '0..15', res: '1 dBZ', val: 54, unit: 'dBZ' },
      { param_id: 'PARAM-22', name: 'Radial Doppler Velocity', bit_range: '16..31', res: '0.5 m/s', val: 58.5, unit: 'm/s' },
      { param_id: 'PARAM-23', name: 'Mesocyclone Azimuth', bit_range: '32..47', res: '0.1 deg', val: 142.6, unit: 'deg' },
      { param_id: 'PARAM-24', name: 'Radius of Maximum Winds', bit_range: '48..63', res: '0.1 km', val: 28.4, unit: 'km' },
    ],
  },
  {
    cycle: 101,
    timestamp: '2026-09-28T22:29:30Z',
    station_id: 'SAT-INSAT3DR-IR1',
    source_type: 'ISRO GEOSAT',
    message_name: 'DVORAK_T_NUMBER_RECORD',
    raw_hex: '06 50 09 32 02 15 00 1E',
    decoded: 'INSAT-3DR Dvorak T-Number: T6.5 (Central Dense Overcast / Eye Pinprick)',
    fields: [
      { param_id: 'PARAM-31', name: 'Dvorak Intensity T-Number', bit_range: '0..15', res: '0.5 T', val: 'T6.5', unit: 'T' },
      { param_id: 'PARAM-32', name: 'Cloud Top Brightness Temp', bit_range: '16..31', res: '0.1 K', val: 192.4, unit: 'K' },
      { param_id: 'PARAM-33', name: 'Central Eye Diameter', bit_range: '32..47', res: '1 km', val: 24, unit: 'km' },
      { param_id: 'PARAM-34', name: 'Dvorak Category Equiv.', bit_range: '48..63', res: 'text', val: 'Cat 4 Super', unit: '' },
    ],
  },
];

export function TelemetryFdrMonitor() {
  const [search, setSearch] = useState('');
  const [expandedRow, setExpandedRow] = useState<number | null>(0);

  const filteredPackets = useMemo(() => {
    if (!search.trim()) return SAMPLE_PACKETS;
    const q = search.toLowerCase();
    return SAMPLE_PACKETS.filter(
      (p) =>
        p.station_id.toLowerCase().includes(q) ||
        p.source_type.toLowerCase().includes(q) ||
        p.message_name.toLowerCase().includes(q) ||
        p.decoded.toLowerCase().includes(q)
    );
  }, [search]);

  const exportCSV = () => {
    const headers = ['cycle', 'timestamp', 'station_id', 'source_type', 'message_name', 'raw_hex', 'decoded'];
    const rows = SAMPLE_PACKETS.map((p) => [
      p.cycle,
      p.timestamp,
      p.station_id,
      p.source_type,
      `"${p.message_name}"`,
      `"${p.raw_hex}"`,
      `"${p.decoded}"`,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cyclone_fdr_telemetry_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(SAMPLE_PACKETS, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cyclone_fdr_telemetry_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Top metrics strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border/80 bg-card p-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Ingestion Protocols
          </div>
          <div className="mt-1 font-mono text-xl font-bold text-foreground">WMO / BUFR</div>
          <div className="text-[11px] text-muted-foreground">OASIS CAP 1.2 Compliant</div>
        </div>

        <div className="rounded-xl border border-border/80 bg-card p-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Active Feed Packets
          </div>
          <div className="mt-1 font-mono text-xl font-bold text-primary">
            {SAMPLE_PACKETS.length} / 250
          </div>
          <div className="text-[11px] text-muted-foreground">Rolling flight recorder ring-buffer</div>
        </div>

        <div className="rounded-xl border border-border/80 bg-card p-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Telemetry Rate
          </div>
          <div className="mt-1 font-mono text-xl font-bold text-emerald-400">10.0 Hz</div>
          <div className="text-[11px] text-muted-foreground">100% Packet Integrity (CRC OK)</div>
        </div>

        <div className="rounded-xl border border-border/80 bg-card p-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            FDR Status
          </div>
          <div className="mt-1 flex items-center gap-1.5 font-mono text-xl font-bold text-foreground">
            <Radio className="h-4 w-4 animate-pulse text-emerald-400" />
            <span>RECORDING</span>
          </div>
          <div className="text-[11px] text-muted-foreground">PostGIS Time-Series Mirror Active</div>
        </div>
      </div>

      {/* Main FDR Table */}
      <div className="rounded-xl border border-border/80 bg-card overflow-hidden shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border/80 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-foreground">
                Meteorological Telemetry Flight Data Recorder (FDR) & Protocol Sniffer
              </h3>
              <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-400 font-bold">
                J1939 / WMO DECODER
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Live broadcast sensor packets captured from AWS stations, Doppler radars, and marine buoys. Click any row to inspect raw hex bytes and parameter scaling.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-48 sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                placeholder="Filter Station, Protocol, or Message..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-full rounded-lg border border-border/80 bg-background/80 pl-8 pr-2 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <button
              onClick={exportCSV}
              className="flex h-8 items-center gap-1 rounded-lg border border-border/80 bg-background/80 px-2.5 text-xs font-medium text-foreground hover:bg-muted"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>

            <button
              onClick={exportJSON}
              className="flex h-8 items-center gap-1 rounded-lg border border-border/80 bg-background/80 px-2.5 text-xs font-medium text-foreground hover:bg-muted"
            >
              <Download className="h-3.5 w-3.5" />
              JSON
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="max-h-[500px] overflow-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="sticky top-0 bg-muted/95 text-[10px] font-bold uppercase tracking-wider text-muted-foreground backdrop-blur-md">
              <tr>
                <th className="px-3 py-2.5 w-8"></th>
                <th className="px-3 py-2.5">Cycle</th>
                <th className="px-3 py-2.5">Station ID</th>
                <th className="px-3 py-2.5">Source Type</th>
                <th className="px-3 py-2.5">Message Group</th>
                <th className="px-3 py-2.5">Raw Hex Data</th>
                <th className="px-3 py-2.5">Decoded Observation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filteredPackets.map((p, idx) => {
                const isExpanded = expandedRow === idx;
                const hexBytes = p.raw_hex.split(' ');

                return (
                  <React.Fragment key={idx}>
                    <tr
                      onClick={() => setExpandedRow(isExpanded ? null : idx)}
                      className={`cursor-pointer transition-colors ${
                        isExpanded ? 'bg-primary/10' : 'hover:bg-muted/40'
                      }`}
                    >
                      <td className="px-2 py-2 text-center text-muted-foreground">
                        {isExpanded ? (
                          <ChevronDown className="inline h-3.5 w-3.5 text-primary" />
                        ) : (
                          <ChevronRight className="inline h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </td>
                      <td className="px-3 py-2 font-bold text-primary">C{p.cycle}</td>
                      <td className="px-3 py-2 font-semibold text-foreground">{p.station_id}</td>
                      <td className="px-3 py-2 text-muted-foreground">{p.source_type}</td>
                      <td className="px-3 py-2">
                        <span className="rounded border border-primary/30 px-1.5 py-0.5 text-[10px] font-mono text-primary">
                          {p.message_name}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-amber-400 font-bold tracking-wider">
                        {p.raw_hex}
                      </td>
                      <td className="px-3 py-2 font-sans text-xs text-foreground/90">
                        {p.decoded}
                      </td>
                    </tr>

                    {/* Expanded Bit-Level Parameter Group Breakdown */}
                    {isExpanded && (
                      <tr className="border-b-2 border-primary/20 bg-muted/20">
                        <td colSpan={7} className="px-6 py-4">
                          <div className="flex flex-col gap-3 font-sans">
                            {/* Raw Byte Map */}
                            <div>
                              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                Raw Byte Breakdown (Bytes 0 to 7)
                              </div>
                              <div className="flex flex-wrap gap-1.5 font-mono text-xs">
                                {hexBytes.map((byte, bIdx) => (
                                  <div
                                    key={bIdx}
                                    className="flex flex-col items-center rounded border border-border/80 bg-card px-2.5 py-1"
                                  >
                                    <span className="text-[9px] text-muted-foreground">B{bIdx}</span>
                                    <span className="font-bold text-amber-400">0x{byte}</span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Signal Parameter Table */}
                            <div>
                              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                Decoded Meteorological Signal Parameters
                              </div>
                              <div className="overflow-hidden rounded-md border border-border/60 bg-card/60">
                                <table className="w-full text-left text-xs">
                                  <thead className="bg-muted/60 text-[10px] font-bold uppercase text-muted-foreground">
                                    <tr>
                                      <th className="px-3 py-1.5 font-mono">Signal ID</th>
                                      <th className="px-3 py-1.5">Parameter Name</th>
                                      <th className="px-3 py-1.5 font-mono">Bit Range</th>
                                      <th className="px-3 py-1.5">Scaling / Resolution</th>
                                      <th className="px-3 py-1.5 text-right font-mono">Engineering Value</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-border/40 font-mono text-[11px]">
                                    {p.fields.map((f, fIdx) => (
                                      <tr key={fIdx} className="hover:bg-muted/30">
                                        <td className="px-3 py-1.5 font-bold text-primary">{f.param_id}</td>
                                        <td className="px-3 py-1.5 font-sans font-medium text-foreground">{f.name}</td>
                                        <td className="px-3 py-1.5 text-muted-foreground">Bits {f.bit_range}</td>
                                        <td className="px-3 py-1.5 text-xs text-muted-foreground">{f.res}</td>
                                        <td className="px-3 py-1.5 text-right font-bold text-emerald-400">
                                          {f.val} {f.unit}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
