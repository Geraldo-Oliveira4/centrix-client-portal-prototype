'use client';

// Mapa de rotas das boas-vindas (Prompt 4). SVG feito à mão: continentes
// simplificados em projeção equirretangular, sem tiles, sem lib e sem rede —
// a única dependência de rede do portal continua sendo o mapa de Meus
// Embarques (decisão de 12/08/2026).
//
// O mapa é ILUSTRAÇÃO de rota, não posição de carga: os pontos são os portos
// e aeroportos da lista curta, nas coordenadas públicas deles.

import { cn } from '@/lib/utils';

import {
  ROUTE_DESTINATIONS,
  ROUTE_ORIGINS,
  arcPath,
  placeName,
  projectPlace,
  type PreferredRoute,
} from './onboarding';

// Contornos grosseiros, em (lon, lat). Basta que se reconheçam os continentes.
const LAND: [number, number][][] = [
  [
    [-165, 68],
    [-140, 70],
    [-110, 72],
    [-85, 70],
    [-65, 62],
    [-55, 50],
    [-70, 43],
    [-80, 32],
    [-81, 25],
    [-90, 29],
    [-97, 26],
    [-97, 20],
    [-88, 15],
    [-83, 9],
    [-79, 8],
    [-90, 14],
    [-105, 20],
    [-112, 30],
    [-118, 34],
    [-124, 40],
    [-124, 48],
    [-135, 58],
    [-150, 60],
    [-165, 62],
  ],
  [
    [-50, 82],
    [-25, 82],
    [-20, 72],
    [-40, 60],
    [-55, 68],
  ],
  [
    [-80, 10],
    [-60, 11],
    [-50, 0],
    [-35, -6],
    [-40, -22],
    [-48, -28],
    [-58, -38],
    [-65, -55],
    [-72, -50],
    [-73, -38],
    [-71, -18],
    [-81, -5],
    [-78, 2],
  ],
  [
    [-10, 36],
    [-9, 43],
    [-2, 48],
    [-5, 58],
    [5, 62],
    [15, 70],
    [30, 71],
    [40, 66],
    [30, 58],
    [40, 45],
    [28, 41],
    [22, 36],
    [12, 38],
    [5, 43],
    [-1, 37],
  ],
  [
    [-5, 50],
    [1, 51],
    [-2, 56],
    [-6, 58],
    [-5, 54],
  ],
  [
    [-17, 15],
    [-17, 21],
    [-10, 30],
    [-5, 36],
    [10, 37],
    [20, 32],
    [32, 31],
    [35, 25],
    [43, 12],
    [51, 11],
    [40, -3],
    [40, -15],
    [35, -25],
    [25, -34],
    [18, -34],
    [13, -20],
    [9, -2],
    [8, 4],
    [-8, 4],
    [-14, 10],
  ],
  [
    [30, 70],
    [60, 70],
    [80, 73],
    [110, 76],
    [140, 72],
    [170, 68],
    [180, 66],
    [160, 60],
    [142, 50],
    [135, 43],
    [127, 38],
    [122, 31],
    [120, 22],
    [108, 20],
    [105, 10],
    [100, 13],
    [98, 8],
    [92, 22],
    [88, 22],
    [78, 8],
    [72, 20],
    [66, 25],
    [57, 25],
    [50, 30],
    [44, 13],
    [35, 30],
    [30, 45],
    [40, 45],
    [30, 58],
  ],
  [
    [130, 31],
    [141, 36],
    [142, 44],
    [140, 41],
    [135, 34],
  ],
  [
    [114, -22],
    [122, -18],
    [130, -12],
    [137, -12],
    [142, -11],
    [146, -19],
    [153, -28],
    [150, -37],
    [140, -38],
    [131, -31],
    [115, -34],
  ],
];

const toPoints = (shape: [number, number][]) =>
  shape
    .map(([lon, lat]) => `${(lon + 180).toFixed(1)},${(90 - lat).toFixed(1)}`)
    .join(' ');

const PLACES = [...ROUTE_ORIGINS, ...ROUTE_DESTINATIONS];

// Rótulos dos pontos que ficam colados (Shanghai/Ningbo, Santos/Guarulhos/
// Itajaí) saem para lados diferentes.
const LABEL_OFFSET: Record<
  string,
  { dx: number; dy: number; anchor: 'start' | 'end' }
> = {
  CNSHA: { dx: 3, dy: -2, anchor: 'start' },
  CNNGB: { dx: 3, dy: 4, anchor: 'start' },
  DEHAM: { dx: -3, dy: -2, anchor: 'end' },
  FRA: { dx: -3, dy: 4, anchor: 'end' },
  BRSSZ: { dx: 3, dy: 1, anchor: 'start' },
  GRU: { dx: -3, dy: -2, anchor: 'end' },
  BRITJ: { dx: -3, dy: 4, anchor: 'end' },
};

export function RouteMap({
  routes,
  draft,
  onPick,
  className,
}: {
  routes: PreferredRoute[];
  /** A rota sendo escolhida agora (origem e/ou destino). */
  draft: { origin?: string; destination?: string };
  /** Clique num ponto; o mapa só repassa o código. */
  onPick?: (code: string) => void;
  className?: string;
}) {
  const draftFrom = draft.origin ? projectPlace(draft.origin) : null;
  const draftTo = draft.destination ? projectPlace(draft.destination) : null;
  const used = new Set(routes.flatMap((r) => [r.origin, r.destination]));

  return (
    <svg
      viewBox="75 12 270 132"
      role="img"
      aria-label={
        routes.length
          ? `Mapa com as rotas: ${routes.map((r) => `${placeName(r.origin)} para ${placeName(r.destination)}`).join('; ')}`
          : 'Mapa das rotas, ainda sem rota escolhida'
      }
      className={cn(
        'h-auto w-full rounded-lg bg-brand-indigo-100/60',
        className,
      )}
    >
      {LAND.map((shape, i) => (
        <polygon
          key={i}
          points={toPoints(shape)}
          className="fill-card stroke-border"
          strokeWidth={0.4}
        />
      ))}

      {routes.map((route) => {
        const from = projectPlace(route.origin);
        const to = projectPlace(route.destination);
        if (!from || !to) return null;
        return (
          <path
            key={`${route.origin}>${route.destination}`}
            d={arcPath(from, to)}
            pathLength={1}
            className="route-arc fill-none stroke-brand-orange"
            strokeWidth={1.4}
            strokeLinecap="round"
          />
        );
      })}

      {draftFrom && draftTo && (
        <path
          d={arcPath(draftFrom, draftTo)}
          className="fill-none stroke-brand-indigo"
          strokeWidth={0.9}
          strokeDasharray="2 2"
        />
      )}

      {PLACES.map((place) => {
        const p = projectPlace(place.code);
        if (!p) return null;
        const label = LABEL_OFFSET[place.code] ?? {
          dx: 3,
          dy: 1,
          anchor: 'start' as const,
        };
        const active =
          draft.origin === place.code ||
          draft.destination === place.code ||
          used.has(place.code);
        const point = (
          <>
            <circle
              cx={p.x}
              cy={p.y}
              r={active ? 2.2 : 1.6}
              className={cn(
                active ? 'fill-brand-orange' : 'fill-brand-indigo',
                'stroke-card',
              )}
              strokeWidth={0.6}
            />
            <text
              x={p.x + label.dx}
              y={p.y + label.dy}
              textAnchor={label.anchor}
              className={cn('fill-foreground', active ? 'font-semibold' : '')}
              fontSize={4.2}
            >
              {place.name}
            </text>
          </>
        );
        return onPick ? (
          <g
            key={place.code}
            role="button"
            tabIndex={0}
            aria-label={`${place.name} (${place.modal === 'AEREO' ? 'aeroporto' : 'porto'})`}
            className="cursor-pointer focus:outline-none [&:focus-visible>circle]:stroke-brand-orange"
            onClick={() => onPick(place.code)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onPick(place.code);
              }
            }}
          >
            {point}
          </g>
        ) : (
          <g key={place.code}>{point}</g>
        );
      })}
    </svg>
  );
}
