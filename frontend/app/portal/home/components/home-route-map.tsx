'use client';

// O "Mapa dos embarques" da Home com as rotas das boas-vindas por cima
// (Prompt 5). `ShipmentMap` entra inteiro; o que este arquivo acrescenta é uma
// camada pelo slot `children` dele. Toca `window` no import (Leaflet), por isso
// o registro o carrega com `dynamic({ ssr: false })`.
//
// As rotas são ESCOLHA do cliente, não posição de carga: arco laranja, por
// cima dos arcos tracejados dos embarques, e a principal mais grossa. Na
// revelação o arco se desenha (`.home-route-draw`, só com movimento permitido).

import { useEffect, useRef } from 'react';
import { CircleMarker, Polyline, Tooltip } from 'react-leaflet';
import type { Polyline as LeafletPolyline } from 'leaflet';

import type { PortalShipment } from '@/types/portal-shipment';

import {
  PLACE_COORDS,
  placeName,
  routeArcLatLngs,
  type PreferredRoute,
} from '../../_shared/onboarding';
import { ShipmentMap } from '../../embarques/components/shipment-map';

// Hex, não classe: o SVG é do Leaflet (mesma regra de `shipment-map.tsx`).
const BRAND_ORANGE_HEX = '#F59C27';

function ChosenRoute({
  route,
  main,
  animate,
}: {
  route: PreferredRoute;
  main: boolean;
  animate: boolean;
}) {
  const ref = useRef<LeafletPolyline | null>(null);
  const positions = routeArcLatLngs(route.origin, route.destination);

  // O desenho do arco usa `pathLength=1` (mesma técnica do mapa das
  // boas-vindas); o Leaflet não expõe o atributo, então ele entra no elemento.
  useEffect(() => {
    const el = ref.current?.getElement();
    if (!el) return;
    el.setAttribute('pathLength', '1');
    if (animate) el.classList.add('home-route-draw');
    else el.classList.remove('home-route-draw');
  }, [animate]);

  const origin = PLACE_COORDS[route.origin];
  if (!positions || !origin) return null;
  const label = `${placeName(route.origin)} → ${placeName(route.destination)}`;
  return (
    <>
      <Polyline
        ref={ref}
        positions={positions}
        pathOptions={{
          color: BRAND_ORANGE_HEX,
          weight: main ? 4 : 3,
          opacity: main ? 0.95 : 0.75,
          lineCap: 'round',
        }}
      >
        <Tooltip sticky>
          {main ? 'Sua rota principal' : 'Sua rota'}: {label}
        </Tooltip>
      </Polyline>
      <CircleMarker
        center={[origin[1], origin[0]]}
        radius={main ? 6 : 5}
        pathOptions={{
          color: '#FFFFFF',
          weight: 2,
          fillColor: BRAND_ORANGE_HEX,
          fillOpacity: 1,
        }}
      >
        <Tooltip direction="top" permanent={main} offset={[0, -6]}>
          {main ? `Sua rota principal: ${label}` : label}
        </Tooltip>
      </CircleMarker>
    </>
  );
}

export function HomeRouteMap({
  shipments,
  originByShipmentId,
  routes,
  animate,
}: {
  shipments: PortalShipment[];
  originByShipmentId: Record<string, string | null>;
  routes: PreferredRoute[];
  animate: boolean;
}) {
  return (
    <ShipmentMap shipments={shipments} originByShipmentId={originByShipmentId}>
      {routes.map((route, index) => (
        <ChosenRoute
          key={`${route.origin}>${route.destination}`}
          route={route}
          main={index === 0}
          animate={animate}
        />
      ))}
    </ShipmentMap>
  );
}
