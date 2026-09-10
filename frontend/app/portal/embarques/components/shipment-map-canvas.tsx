'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Minus, Plus } from 'lucide-react';
import type { Port } from '../lib/port-coordinates';
import { DESTINATION_PORT } from '../lib/port-coordinates';
import styles from './shipment-map-workspace.module.css';

type Plotted = { id: string; port: Port; attention: boolean };
type Camera = { x: number; y: number; k: number };
const project = (lon: number, lat: number) => [
  ((lon + 180) * 1200) / 360,
  240 - (lat * 1200) / 360,
];
const destination = project(DESTINATION_PORT.lon, DESTINATION_PORT.lat);

export function ShipmentMapCanvas({
  plotted,
  focus,
  selectedIds,
  onSelect,
  onReset,
}: {
  plotted: Plotted[];
  focus: { lat: number; lon: number } | null;
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  onReset: () => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null),
    cameraRef = useRef<SVGGElement>(null);
  const current = useRef<Camera>({ x: 0, y: 0, k: 1 });
  const [target, setTarget] = useState<Camera>({ x: 0, y: 0, k: 1 });
  const [size, setSize] = useState({ width: 1200, height: 480 });
  const reduced = useRef(false),
    focusKey = focus ? `${focus.lat},${focus.lon}` : '';
  const screenScale = Math.max(
    0.1,
    Math.min(size.width / 1200, size.height / 480),
  );
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    reduced.current = preference.matches;
    const changed = () => {
      reduced.current = preference.matches;
    };
    preference.addEventListener('change', changed);
    const observer = new ResizeObserver((entries) =>
      setSize({
        width: entries[0].contentRect.width,
        height: entries[0].contentRect.height,
      }),
    );
    if (svgRef.current) observer.observe(svgRef.current);
    return () => {
      observer.disconnect();
      preference.removeEventListener('change', changed);
    };
  }, []);
  useEffect(() => {
    if (!focusKey) {
      setTarget({ x: 0, y: 0, k: 1 });
      return;
    }
    const [lat, lon] = focusKey.split(',').map(Number),
      [x, y] = project(lon, lat),
      k = 1.8;
    setTarget({ x: 600 - x * k, y: 245 - y * k, k });
  }, [focusKey]);
  useEffect(() => {
    let frame = 0;
    const start = { ...current.current },
      startAt = performance.now();
    function animate(time: number) {
      const t = reduced.current ? 1 : Math.min(1, (time - startAt) / 650),
        ease = 1 - (1 - t) ** 3;
      const c = {
        x: start.x + (target.x - start.x) * ease,
        y: start.y + (target.y - start.y) * ease,
        k: start.k + (target.k - start.k) * ease,
      };
      current.current = c;
      cameraRef.current?.setAttribute(
        'transform',
        `translate(${c.x} ${c.y}) scale(${c.k})`,
      );
      svgRef.current
        ?.querySelectorAll('[data-map-pin]')
        .forEach((n) =>
          n.setAttribute('transform', `scale(${1 / (c.k * screenScale)})`),
        );
      if (t < 1) frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [target, screenScale]);
  // Nearby origins share an accessible hit target. The panel lists every member.
  const clusters = useMemo(() => {
    const result: { x: number; y: number; items: Plotted[] }[] = [];
    for (const item of plotted) {
      const [x, y] = project(item.port.lon, item.port.lat);
      const found = result.find(
        (c) => Math.hypot(c.x - x, c.y - y) * target.k * screenScale < 43,
      );
      if (found) {
        const n = found.items.length;
        found.x = (found.x * n + x) / (n + 1);
        found.y = (found.y * n + y) / (n + 1);
        found.items.push(item);
      } else result.push({ x, y, items: [item] });
    }
    return result;
  }, [plotted, target.k, screenScale]);
  function zoom(factor: number) {
    const c = current.current,
      k = Math.min(4, Math.max(1, c.k * factor)),
      ratio = k / c.k;
    setTarget({
      x: 600 - (600 - c.x) * ratio,
      y: 240 - (240 - c.y) * ratio,
      k,
    });
  }
  return (
    <>
      <svg
        ref={svgRef}
        className={styles.mapSvg}
        viewBox="0 0 1200 480"
        role="group"
        aria-label="Portos de origem dos embarques"
      >
        <g ref={cameraRef}>
          <image href="/maps/centrix-world.svg" width="1200" height="480" />
          {clusters.map((cluster) => {
            const picked = cluster.items.some((p) =>
              selectedIds.includes(p.id),
            );
            return (
              <path
                key={`route-${cluster.items[0].id}`}
                d={`M${cluster.x},${cluster.y} Q${(cluster.x + destination[0]) / 2},${Math.min(cluster.y, destination[1]) - 90} ${destination[0]},${destination[1]}`}
                fill="none"
                stroke={
                  picked
                    ? '#787098'
                    : cluster.items.some((p) => p.attention)
                      ? '#b38b87'
                      : '#8faea6'
                }
                strokeWidth={picked ? 2 : 1}
                strokeDasharray={picked ? undefined : '5 7'}
                opacity={selectedIds.length ? (picked ? 0.85 : 0.1) : 0.5}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
          {clusters.map((cluster) => {
            const picked = cluster.items.some((p) =>
                selectedIds.includes(p.id),
              ),
              attention = cluster.items.filter((p) => p.attention).length;
            const names = Array.from(
                new Set(cluster.items.map((p) => p.port.name)),
              ),
              label = names.length > 1 ? `${names.length} origens` : names[0];
            return (
              <g
                key={cluster.items.map((p) => p.id).join('|')}
                transform={`translate(${cluster.x} ${cluster.y})`}
                role="button"
                tabIndex={0}
                aria-label={`${names.join(', ')}: ${cluster.items.length} embarques, ${attention} com atenção`}
                className={styles.port}
                onClick={() => onSelect(cluster.items.map((p) => p.id))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(cluster.items.map((p) => p.id));
                  }
                }}
              >
                <g
                  data-map-pin
                  transform={`scale(${1 / (current.current.k * screenScale)})`}
                >
                  {picked && <circle r={25} fill="#786c9a" opacity={0.17} />}
                  <circle
                    r={17}
                    fill={picked ? '#655884' : '#29334a'}
                    stroke="white"
                    strokeWidth={2}
                  />
                  <text
                    textAnchor="middle"
                    dy={5}
                    fill="white"
                    fontSize={13}
                    fontWeight={600}
                  >
                    {cluster.items.length}
                  </text>
                  <circle
                    cx={12}
                    cy={-12}
                    r={4.5}
                    fill={attention ? '#bb5159' : '#25876e'}
                    stroke="white"
                    strokeWidth={1.5}
                  />
                  <text
                    textAnchor="middle"
                    y={32}
                    fill="#596c80"
                    stroke="#e4edf2"
                    strokeWidth={3}
                    paintOrder="stroke"
                    fontSize={10}
                  >
                    {label}
                  </text>
                </g>
              </g>
            );
          })}
          <g transform={`translate(${destination[0]} ${destination[1]})`}>
            <g
              data-map-pin
              transform={`scale(${1 / (current.current.k * screenScale)})`}
            >
              <circle r={5} fill="#78869b" stroke="white" strokeWidth={2} />
              <text y={22} textAnchor="middle" fill="#65778b" fontSize={10}>
                Santos · referência visual
              </text>
            </g>
          </g>
        </g>
      </svg>
      <div className={styles.mapControls}>
        <button onClick={() => zoom(1.25)} aria-label="Aproximar mapa">
          <Plus size={16} />
        </button>
        <button onClick={() => zoom(0.8)} aria-label="Afastar mapa">
          <Minus size={16} />
        </button>
        <button
          aria-label="Voltar à visão geral"
          onClick={() => {
            onReset();
            setTarget({ x: 0, y: 0, k: 1 });
          }}
        >
          <Maximize2 size={14} />
        </button>
      </div>
      <div className={styles.legend}>
        <span>
          <i /> Com atenção
        </span>
        <span>
          <i /> Sem pendência registrada
        </span>
      </div>
      <span className={styles.carto}>Base: Natural Earth / world-atlas</span>
    </>
  );
}
