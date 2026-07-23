'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Info } from 'lucide-react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui';
import { cn } from '@/lib/utils';
import {
  ESTADO_ACCENT_CLASS,
  ESTADO_LABELS,
  type EmbarqueEstado,
  type PortalShipment,
} from '@/types/portal-shipment';

import { EstadoBadge } from './estado-badge';

// Illustrative world map. NOT geographically exact and NOT a tracking feed:
// there is no GPS/AIS/carrier position in this repo. Each active shipment is
// pinned to an approximate export-hub position derived deterministically from
// its EMB reference (so it stays put between renders) and drawn as an arc to
// Brazil, the single import destination. The arc colour is the real state; the
// origin is decorative. Same honesty caption as ShipmentRoute — keep it.

const VIEW_W = 1000;
const VIEW_H = 500;

// Equirectangular projection into the 1000x500 viewBox (2:1), so the HTML marker
// overlay can reuse the same coordinates as simple percentages.
function project(lon: number, lat: number): { x: number; y: number } {
  return { x: ((lon + 180) / 360) * VIEW_W, y: ((90 - lat) / 180) * VIEW_H };
}

interface Hub {
  name: string;
  lon: number;
  lat: number;
}

// Approximate positions of common export hubs across Asia, Europe and North
// America. Fixed and illustrative — not the shipment's real port of loading.
const ORIGINS: Hub[] = [
  { name: 'Shanghai', lon: 121.5, lat: 31.2 },
  { name: 'Hamburg', lon: 10.0, lat: 53.5 },
  { name: 'Los Angeles', lon: -118.2, lat: 34.0 },
  { name: 'Busan', lon: 129.0, lat: 35.1 },
  { name: 'Rotterdam', lon: 4.5, lat: 51.9 },
  { name: 'New York', lon: -74.0, lat: 40.7 },
  { name: 'Shenzhen', lon: 114.1, lat: 22.5 },
  { name: 'Genova', lon: 8.9, lat: 44.4 },
  { name: 'Singapura', lon: 103.8, lat: 1.35 },
  { name: 'Houston', lon: -95.4, lat: 29.8 },
];

const DESTINATION: Hub = { name: 'Brasil (Santos)', lon: -46.33, lat: -23.95 };

// Rough, stylised continent outlines ([lon, lat] rings). Deliberately low-detail
// — the map is a backdrop for the routes, not a reference atlas.
const CONTINENTS: Array<Array<[number, number]>> = [
  [
    [-168, 66], [-158, 71], [-130, 70], [-95, 60], [-82, 52], [-64, 60],
    [-56, 52], [-66, 45], [-70, 42], [-75, 35], [-81, 25], [-97, 18],
    [-105, 20], [-114, 30], [-124, 40], [-125, 48], [-140, 58], [-168, 66],
  ],
  [
    [-80, 8], [-70, 10], [-60, 5], [-50, 0], [-35, -5], [-38, -12], [-40, -22],
    [-48, -25], [-53, -34], [-58, -34], [-65, -42], [-70, -50], [-75, -52],
    [-73, -42], [-70, -30], [-71, -18], [-77, -6], [-80, 2],
  ],
  [
    [-10, 36], [-9, 43], [-2, 43], [0, 49], [-5, 50], [-6, 58], [5, 60],
    [10, 64], [24, 70], [30, 66], [40, 64], [45, 55], [40, 48], [30, 45],
    [28, 41], [20, 40], [16, 38], [3, 42], [-10, 36],
  ],
  [
    [-16, 15], [-16, 28], [-10, 35], [10, 37], [24, 32], [32, 31], [36, 22],
    [43, 12], [51, 12], [48, 2], [40, -4], [40, -16], [35, -24], [27, -34],
    [20, -35], [16, -29], [12, -16], [9, -1], [5, 4], [-8, 5], [-16, 15],
  ],
  [
    [28, 41], [40, 48], [45, 55], [60, 55], [70, 55], [80, 68], [100, 72],
    [130, 73], [145, 70], [160, 68], [180, 66], [170, 60], [155, 52],
    [142, 50], [135, 44], [130, 35], [122, 30], [120, 22], [108, 10],
    [100, 6], [95, 15], [88, 22], [78, 8], [72, 20], [68, 24], [60, 25],
    [55, 25], [48, 30], [45, 38], [35, 37], [28, 41],
  ],
  [
    [113, -22], [122, -18], [130, -12], [137, -12], [142, -11], [146, -17],
    [150, -24], [153, -28], [148, -38], [140, -38], [130, -32], [123, -34],
    [115, -34], [113, -28], [113, -22],
  ],
];

function continentPath(ring: Array<[number, number]>): string {
  return (
    ring
      .map(([lon, lat], i) => {
        const { x, y } = project(lon, lat);
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ') + ' Z'
  );
}

// Stable index into ORIGINS. Uses the numeric suffix of the EMB reference when
// present (so sequential seeded shipments spread across regions), else a simple
// string hash.
function originIndex(reference: string): number {
  const match = reference.match(/(\d+)\s*$/);
  let n: number;
  if (match) {
    n = parseInt(match[1], 10) - 1;
  } else {
    n = 0;
    for (let i = 0; i < reference.length; i += 1) {
      n = (n * 31 + reference.charCodeAt(i)) >>> 0;
    }
  }
  return ((n % ORIGINS.length) + ORIGINS.length) % ORIGINS.length;
}

interface Placed {
  shipment: PortalShipment;
  x: number;
  y: number;
}

interface LegendEntry {
  estado: EmbarqueEstado;
  label: string;
}

const LEGEND: LegendEntry[] = [
  { estado: 'solicitado', label: 'Em andamento' },
  { estado: 'aguardando_prontidao', label: 'Atenção / aguardando' },
  { estado: 'embarcado', label: 'Embarcado' },
  { estado: 'booking_divergente', label: 'Exceção' },
];

export function ShipmentWorldMap({ shipments }: { shipments: PortalShipment[] }) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const dest = project(DESTINATION.lon, DESTINATION.lat);

  // Fan out shipments that land on the same origin so their markers do not
  // stack into a single dot.
  const placed = useMemo<Placed[]>(() => {
    const groups = new Map<number, PortalShipment[]>();
    shipments.forEach((s) => {
      const idx = originIndex(s.referencia);
      const list = groups.get(idx) ?? [];
      list.push(s);
      groups.set(idx, list);
    });

    const result: Placed[] = [];
    groups.forEach((list, idx) => {
      const base = project(ORIGINS[idx].lon, ORIGINS[idx].lat);
      const radius = list.length > 1 ? 12 : 0;
      list.forEach((shipment, i) => {
        const angle = (i / list.length) * Math.PI * 2;
        result.push({
          shipment,
          x: base.x + Math.cos(angle) * radius,
          y: base.y + Math.sin(angle) * radius,
        });
      });
    });
    return result;
  }, [shipments]);

  if (shipments.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="relative aspect-[2/1] w-full overflow-hidden rounded-lg border bg-card">
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-0 h-full w-full"
          role="img"
          aria-label="Mapa ilustrativo dos embarques ativos por região de origem"
        >
          {/* Graticule. currentColor + explicit opacity attrs so it does not
              depend on Tailwind fill/stroke opacity-modifier support. */}
          <g
            className="text-portal-neutral"
            stroke="currentColor"
            strokeOpacity={0.15}
            strokeWidth={0.5}
          >
            {[-120, -60, 0, 60, 120].map((lon) => {
              const { x } = project(lon, 0);
              return <line key={`v${lon}`} x1={x} y1={0} x2={x} y2={VIEW_H} />;
            })}
            {[60, 30, 0, -30, -60].map((lat) => {
              const { y } = project(0, lat);
              return <line key={`h${lat}`} x1={0} y1={y} x2={VIEW_W} y2={y} />;
            })}
          </g>

          {/* Landmasses */}
          <g
            className="text-portal-neutral"
            fill="currentColor"
            fillOpacity={0.2}
            stroke="currentColor"
            strokeOpacity={0.3}
            strokeWidth={0.75}
          >
            {CONTINENTS.map((ring, i) => (
              <path key={i} d={continentPath(ring)} />
            ))}
          </g>

          {/* Routes: one dashed arc per shipment, coloured by state. */}
          {placed.map(({ shipment, x, y }) => {
            const mx = (x + dest.x) / 2;
            const my = (y + dest.y) / 2;
            const dx = dest.x - x;
            const dy = dest.y - y;
            const len = Math.hypot(dx, dy) || 1;
            const lift = len * 0.18;
            const cx = mx + (-dy / len) * lift;
            const cy = my + (dx / len) * lift;
            const active = hoveredId === shipment.id;
            return (
              <path
                key={shipment.id}
                d={`M${x.toFixed(1)} ${y.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${dest.x.toFixed(1)} ${dest.y.toFixed(1)}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={active ? 3 : 1.75}
                strokeDasharray="5 5"
                strokeLinecap="round"
                className={cn(
                  ESTADO_ACCENT_CLASS[shipment.estado],
                  'transition-opacity',
                  active ? 'opacity-100' : 'opacity-60',
                )}
              />
            );
          })}

          {/* Origin markers */}
          {placed.map(({ shipment, x, y }) => {
            const active = hoveredId === shipment.id;
            return (
              <circle
                key={shipment.id}
                cx={x}
                cy={y}
                r={active ? 8 : 6}
                fill="currentColor"
                className={cn(
                  ESTADO_ACCENT_CLASS[shipment.estado],
                  'stroke-card transition-all',
                )}
                strokeWidth={2.5}
              />
            );
          })}

          {/* Destination hub (Brazil) */}
          <g>
            <circle
              cx={dest.x}
              cy={dest.y}
              r={9}
              className="fill-foreground stroke-card"
              strokeWidth={2.5}
            />
            <text
              x={dest.x}
              y={dest.y + 26}
              textAnchor="middle"
              className="fill-portal-neutral text-[13px] font-medium"
            >
              Brasil
            </text>
          </g>
        </svg>

        {/* Interactive overlay: transparent hit targets aligned to the SVG dots.
            Hover enlarges the marker; click opens a popover with a detail link. */}
        <div className="absolute inset-0">
          {placed.map(({ shipment, x, y }) => (
            <Popover key={shipment.id}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label={`${shipment.referencia} — ${ESTADO_LABELS[shipment.estado]}`}
                  onMouseEnter={() => setHoveredId(shipment.id)}
                  onMouseLeave={() =>
                    setHoveredId((cur) => (cur === shipment.id ? null : cur))
                  }
                  className="group absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  style={{
                    left: `${(x / VIEW_W) * 100}%`,
                    top: `${(y / VIEW_H) * 100}%`,
                  }}
                >
                  <span className="pointer-events-none absolute bottom-full left-1/2 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 text-[11px] font-medium text-background group-hover:block">
                    {shipment.referencia}
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-56 space-y-3" align="center">
                <div className="space-y-1.5">
                  <p className="portal-body font-medium text-foreground">
                    {shipment.referencia}
                  </p>
                  <EstadoBadge estado={shipment.estado} />
                </div>
                <Link
                  href={`/portal/embarques/${shipment.id}`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  Ver detalhe
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </PopoverContent>
            </Popover>
          ))}
        </div>
      </div>

      {/* Legend + illustrative caption */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {LEGEND.map(({ estado, label }) => (
            <span key={estado} className="inline-flex items-center gap-1.5">
              <span
                className={cn(
                  'h-2.5 w-2.5 rounded-full bg-current',
                  ESTADO_ACCENT_CLASS[estado],
                )}
              />
              <span className="portal-small text-portal-neutral">{label}</span>
            </span>
          ))}
        </div>
        <span className="inline-flex items-center gap-1.5 portal-small text-portal-neutral">
          <Info className="h-3.5 w-3.5" />
          Visão ilustrativa — posições aproximadas por região, não é rastreamento por GPS.
        </span>
      </div>
    </div>
  );
}
