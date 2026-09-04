'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { WeeklyVolume } from '../../lib/volume-helpers';

// Single-series bar chart: embarques opened per week (real, from created_at).
// One hue, so no categorical palette / legend — the section title names it.
// Marks: thin bars, 4px rounded top ends anchored to the baseline; recessive
// horizontal grid; per-bar hover tooltip. Fill is Indigo #2C2E65, hard-coded
// rather than hsl(var(--primary)): since Brand System v1.0 --primary is the
// ORANGE CTA surface, and a full-width bar chart in it would be the single
// largest orange area in the portal — orange is a 10% ceiling, not a fill.
// Indigo is the brand colour for data marks; the indigo-600 ticks recede
// against it on either surface.
//
// As duas cores saem de VARIAVEL (`--indigo` para a barra, `--portal-neutral`
// para os ticks), nao de hex: no escuro o indigo de luz da 1.20:1 contra o
// canvas e o grafico inteiro sumia — barras invisiveis com os eixos ainda
// desenhados.

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: WeeklyVolume }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-md border bg-card px-2.5 py-1.5 shadow-sm">
      <p className="portal-small font-medium text-foreground">Semana de {d.label}</p>
      <p className="portal-small text-portal-neutral">
        {d.count} {d.count === 1 ? 'embarque aberto' : 'embarques abertos'}
      </p>
    </div>
  );
}

export function WeeklyVolumeChart({ data }: { data: WeeklyVolume[] }) {
  const empty = data.every((d) => d.count === 0);

  return (
    <div className="space-y-2">
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
            <CartesianGrid
              vertical={false}
              stroke="hsl(var(--border))"
              strokeOpacity={0.6}
            />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'hsl(var(--portal-neutral))', fontSize: 12 }}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              width={28}
              tick={{ fill: 'hsl(var(--portal-neutral))', fontSize: 12 }}
            />
            <Tooltip
              cursor={{ fill: 'hsl(var(--muted))', fillOpacity: 0.5 }}
              content={<ChartTooltip />}
            />
            <Bar
              dataKey="count"
              fill="hsl(var(--indigo))"
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {empty ? (
        <p className="portal-small text-center text-portal-neutral">
          Sem embarques abertos nas últimas semanas.
        </p>
      ) : null}
    </div>
  );
}
