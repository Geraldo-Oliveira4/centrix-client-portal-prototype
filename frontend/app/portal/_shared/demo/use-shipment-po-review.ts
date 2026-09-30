'use client';

// The PO overlay, as the screens consume it. Same shape as
// `use-quotation-review.ts` — one subscription over `localStorage`, no
// provider, and a non-React reader for the callbacks that fire outside a
// render.

import { useMemo } from 'react';

import { readDemoRaw } from './demo-store';
import {
  SHIPMENT_PO_STORE_NAME,
  parseShipmentPoStore,
  type ShipmentPoReview,
  type ShipmentPoStore,
} from './shipment-po-review';
import {
  mergePoShipments,
  type PortalShipmentWithReview,
} from './shipment-po-merge';
import { setDemoValue, useDemoValue } from './use-demo-store';
import { usePortalModuleReleased } from './use-feature-flags';
import type { PortalShipment } from '@/types/portal-shipment';

/** Every overlay entry, `{}` when the flag is off or the journey never started. */
export function useShipmentPoStore(): ShipmentPoStore {
  const released = usePortalModuleReleased('embarqueViaPo');
  const raw = useDemoValue(SHIPMENT_PO_STORE_NAME, parseShipmentPoStore);
  return useMemo(() => (released ? raw : {}), [released, raw]);
}

export function useShipmentPoReview(
  shipmentId: string | null | undefined,
): ShipmentPoReview | null {
  const store = useShipmentPoStore();
  return shipmentId ? (store[shipmentId] ?? null) : null;
}

/**
 * The wallet with the PO shipments folded in.
 *
 * With the flag off, or with no overlay, this returns the SAME array the API
 * gave — which is what keeps Meus Embarques identical outside the journey.
 */
export function useShipmentsWithPo(
  shipments: PortalShipment[],
): PortalShipmentWithReview[] {
  const store = useShipmentPoStore();
  return useMemo(
    () =>
      Object.keys(store).length === 0
        ? shipments
        : mergePoShipments(shipments, store),
    [shipments, store],
  );
}

export function writeShipmentPoStore(store: ShipmentPoStore): void {
  setDemoValue(SHIPMENT_PO_STORE_NAME, store);
}

/** The store, straight from `localStorage`. For non-React callers. */
export function readShipmentPoStore(): ShipmentPoStore {
  if (typeof window === 'undefined') return {};
  let storage: Storage | null = null;
  try {
    storage = window.localStorage;
  } catch {
    return {};
  }
  return parseShipmentPoStore(readDemoRaw(storage, SHIPMENT_PO_STORE_NAME));
}

/**
 * Applies a transition to one entry, reading the CURRENT store first.
 *
 * Reads from storage rather than from a React snapshot: the automatic reply
 * and the panel can write in the same tick, and a stale snapshot would drop
 * one of the two writes.
 */
export function updateShipmentPoReview(
  shipmentId: string,
  apply: (review: ShipmentPoReview) => ShipmentPoReview,
): void {
  const store = readShipmentPoStore();
  const current = store[shipmentId];
  if (!current) return;
  writeShipmentPoStore({ ...store, [shipmentId]: apply(current) });
}

/** Creates or replaces one entry. */
export function putShipmentPoReview(
  shipmentId: string,
  review: ShipmentPoReview,
): void {
  writeShipmentPoStore({ ...readShipmentPoStore(), [shipmentId]: review });
}

export function removeShipmentPoReview(shipmentId: string): void {
  const store = readShipmentPoStore();
  const { [shipmentId]: _dropped, ...rest } = store;
  writeShipmentPoStore(rest);
}

export function clearShipmentPoStore(): void {
  writeShipmentPoStore({});
}
