'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Polyline, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';

import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

import { ESTADO_LABELS, ESTADO_SEMAFORO } from '@/types/portal-shipment';
import type { PortalShipment, SemaforoTone } from '@/types/portal-shipment';

import { DESTINATION_PORT, originPortOf, type Port } from '../lib/port-coordinates';

// Real geography (Leaflet + OpenStreetMap) replacing the stylised SVG map.
//
// The one claim this map makes is "which PORT this shipment is associated with",
// never "where the vessel is". There is no AIS/ShipsGo mapPoint in this repo, so
// a shipment in mid-ocean is drawn at its origin port, stationary. The footnote
// under the map says exactly that, once, for every marker — which is why no
// marker carries its own provenance badge.
//
// The arc is decorative routing, not a sailed track: a quadratic curve sampled
// between two ports, with no waypoint claiming to be a position.

// Hex, not Tailwind classes: these colours cross into Leaflet's own DOM (marker
// divIcons and SVG polylines) where our utility classes are not applied. Kept in
// sync with the semáforo tokens in tailwind.config.ts by name.
const TONE_HEX: Record<SemaforoTone, string> = {
  success: '#00B050',
  warning: '#FF9500',
  danger: '#FF3B30',
};

interface Plotted {
  shipment: PortalShipment;
  port: Port;
  tone: SemaforoTone;
}

function markerIcon(tone: SemaforoTone): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<span style="display:block;width:14px;height:14px;border-radius:9999px;background:${TONE_HEX[tone]};border:2.5px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.35)"></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function destinationIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<span style="display:block;width:16px;height:16px;border-radius:9999px;background:#2C2D65;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

/**
 * Popup content. Built as an HTML string because it is handed to Leaflet, which
 * owns this DOM subtree — React does not render inside a Leaflet popup pane.
 *
 * Every marker says the same two things about position, whatever the source of
 * its coordinates: the port it is plotted at, and that the point is the port and
 * not the vessel. There is deliberately no per-marker "real vs approximate"
 * label.
 */
function popupHtml(shipment: PortalShipment, port: Port): string {
  const tone = ESTADO_SEMAFORO[shipment.estado];
  const po = shipment.client_reference
    ? `<div style="font-size:12px;color:#8E8E93;margin-top:2px">PO ${shipment.client_reference}</div>`
    : '';
  return `
    <div style="min-width:196px;font-family:inherit">
      <div style="font-size:14px;font-weight:600;color:#2C2D65">${shipment.referencia}</div>
      ${po}
      <div style="display:inline-flex;align-items:center;gap:6px;margin-top:8px;font-size:12px;font-weight:500;color:${TONE_HEX[tone]}">
        <span style="width:8px;height:8px;border-radius:9999px;background:${TONE_HEX[tone]}"></span>
        ${ESTADO_LABELS[shipment.estado]}
      </div>
      <dl style="margin:10px 0 0;font-size:12px;line-height:1.5">
        <dt style="color:#8E8E93">Posição no mapa</dt>
        <dd style="margin:0;color:#2C2D65;font-weight:500">${port.name}, ${port.country}</dd>
        <dt style="color:#8E8E93;margin-top:6px">Destino</dt>
        <dd style="margin:0;color:#2C2D65;font-weight:500">${DESTINATION_PORT.name}, ${DESTINATION_PORT.country}</dd>
      </dl>
      <div style="margin-top:8px;font-size:11px;color:#8E8E93;line-height:1.4">
        O ponto marca o porto, não a posição do navio em trânsito.
      </div>
      <a href="/portal/embarques/${shipment.id}"
         style="display:inline-block;margin-top:10px;font-size:13px;font-weight:600;color:#CE0F69;text-decoration:none">
        Ver detalhes &rarr;
      </a>
    </div>
  `;
}

/**
 * Clustered markers, driven imperatively.
 *
 * `leaflet.markercluster` is a Leaflet plugin, not a React component, and the
 * React wrappers around it are pinned to older react-leaflet majors. Attaching
 * it through `useMap()` keeps us on the maintained plugin and off an unmaintained
 * bridge; the whole layer is rebuilt when the shipment list changes, which is
 * cheap at this scale (tens of markers).
 */
function ClusteredMarkers({ plotted }: { plotted: Plotted[] }) {
  const map = useMap();

  useEffect(() => {
    const group = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 36,
      // Cluster badge in the portal's own palette instead of the plugin default
      // green/yellow bubbles, which collide with the semáforo meaning.
      iconCreateFunction: (cluster) =>
        L.divIcon({
          className: '',
          html: `<span style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:9999px;background:#2C2D65;color:#fff;font-size:12px;font-weight:600;border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)">${cluster.getChildCount()}</span>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        }),
    });

    plotted.forEach(({ shipment, port, tone }) => {
      L.marker([port.lat, port.lon], {
        icon: markerIcon(tone),
        title: `${shipment.referencia} — ${ESTADO_LABELS[shipment.estado]}`,
      })
        .bindPopup(popupHtml(shipment, port), { closeButton: true })
        .addTo(group);
    });

    // Fora do cluster de propósito: Santos é o destino de todas as rotas e não
    // deve ser absorvido numa bolha de contagem junto de embarques. Por isso é
    // uma camada própria — e por isso precisa sair no cleanup junto com o grupo,
    // senão cada re-render empilha mais um marcador no mesmo ponto.
    const destination = L.marker(
      [DESTINATION_PORT.lat, DESTINATION_PORT.lon],
      { icon: destinationIcon(), title: `${DESTINATION_PORT.name} — destino` },
    ).bindTooltip(DESTINATION_PORT.name, {
      permanent: true,
      direction: 'bottom',
      className: 'portal-map-label',
    });

    destination.addTo(map);
    map.addLayer(group);
    return () => {
      map.removeLayer(group);
      map.removeLayer(destination);
    };
  }, [map, plotted]);

  return null;
}

/** Sampled quadratic curve between two ports, for a readable arc. */
/**
 * Enquadra o mapa no que está plotado, e reenquadra quando o conjunto muda.
 *
 * Existe por causa dos chips de filtro (14/08/2026): com os treze embarques, a
 * vista fixa do mundo mostrava tudo, mas filtrar para dois deixava as duas
 * origens FORA do quadro — o cliente clicava em "Com exceção" e recebia um mapa
 * com Santos e duas linhas saindo pela borda. Um filtro que esvazia a tela é
 * pior que não filtrar.
 *
 * `maxZoom` existe para o caso de uma origem só: sem ele, dois pontos próximos
 * levariam o mapa a zoom de rua, onde a rota deixa de ser legível como rota.
 */
function FitToPlotted({ plotted }: { plotted: Plotted[] }) {
  const map = useMap();
  // Chave estável pelas coordenadas: o array é recriado a cada render, e usá-lo
  // direto como dependência reenquadraria o mapa continuamente, cancelando o
  // zoom que o usuário tivesse dado.
  const key = plotted.map((p) => p.port.key).sort().join('|');

  useEffect(() => {
    if (plotted.length === 0) return;
    const bounds = L.latLngBounds(
      plotted.map((p) => [p.port.lat, p.port.lon] as [number, number]),
    );
    bounds.extend([DESTINATION_PORT.lat, DESTINATION_PORT.lon]);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 4, animate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);

  return null;
}

function arcPoints(from: Port, to: Port): [number, number][] {
  const lift = 0.22;
  const mx = (from.lat + to.lat) / 2;
  const my = (from.lon + to.lon) / 2;
  const dx = to.lat - from.lat;
  const dy = to.lon - from.lon;
  const cx = mx - dy * lift;
  const cy = my + dx * lift;

  const points: [number, number][] = [];
  for (let i = 0; i <= 24; i += 1) {
    const t = i / 24;
    const u = 1 - t;
    points.push([
      u * u * from.lat + 2 * u * t * cx + t * t * to.lat,
      u * u * from.lon + 2 * u * t * cy + t * t * to.lon,
    ]);
  }
  return points;
}

export function ShipmentMap({
  shipments,
  originByShipmentId,
}: {
  shipments: PortalShipment[];
  /** Origin string of the quotation that generated each shipment, when known. */
  originByShipmentId: Record<string, string | null>;
}) {
  const [tilesFailed, setTilesFailed] = useState(false);
  const errorCount = useRef(0);

  const plotted = useMemo<Plotted[]>(
    () =>
      shipments.map((shipment) => ({
        shipment,
        port: originPortOf(
          shipment.referencia,
          originByShipmentId[shipment.id] ?? null,
        ),
        tone: ESTADO_SEMAFORO[shipment.estado],
      })),
    [shipments, originByShipmentId],
  );

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border">
      <MapContainer
        center={[15, 0]}
        zoom={2}
        // minZoom 1, não 2: a coluna do mapa tem ~574px numa tela de 1440, e a
        // 360° do mundo só cabem aí a partir do zoom 1. Com o piso em 2, o
        // enquadramento de um par distante (Los Angeles e Shenzhen, o recorte
        // "Com exceção") era clampado e as duas origens ficavam fora do quadro,
        // centradas num Atlântico vazio. Ver `FitToPlotted`.
        minZoom={1}
        worldCopyJump
        scrollWheelZoom={false}
        className="h-full w-full bg-muted"
        style={{ background: 'hsl(var(--muted))' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          eventHandlers={{
            // Offline (or a blocked tile host) is a first-class state for this
            // prototype: the project runs without external APIs by design. A few
            // stray errors are normal at the edges of the world, so the note only
            // appears once the failures are clearly systematic.
            tileerror: () => {
              errorCount.current += 1;
              if (errorCount.current > 6) setTilesFailed(true);
            },
            tileload: () => {
              errorCount.current = 0;
              setTilesFailed(false);
            },
          }}
        />

        {plotted.map(({ shipment, port, tone }) => (
          <Polyline
            key={shipment.id}
            positions={arcPoints(port, DESTINATION_PORT)}
            pathOptions={{
              color: TONE_HEX[tone],
              weight: 2,
              opacity: 0.65,
              dashArray: '6 6',
            }}
          />
        ))}

        <ClusteredMarkers plotted={plotted} />
        <FitToPlotted plotted={plotted} />
      </MapContainer>

      {tilesFailed && (
        // `bottom-6` e não `bottom-0`: o rodapé do Leaflet (atribuição do
        // OpenStreetMap) mora no canto inferior direito e é obrigatório pela
        // licença — a nota não pode cobri-lo.
        <div className="pointer-events-none absolute inset-x-0 bottom-6 z-[500] bg-background/90 px-3 py-2 text-center">
          <p className="portal-small text-portal-neutral">
            Mapa base indisponível offline — as rotas e os embarques continuam
            visíveis.
          </p>
        </div>
      )}
    </div>
  );
}
