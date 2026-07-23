// Client Portal shipments (GE tracking). Read-only: the client follows the
// shipment its approved quotation generated, but every operational change
// (booking, documents, follow-ups, state transitions) stays with the analyst's
// GE module, so there is no mutation hook here on purpose.
//
// Hits the portal-scoped routes through portal_api, so the list only ever
// contains shipments owned by this client (see backend
// shared/database/repositories/portal_shipment_repository.py).

import useSWR from 'swr';
import portal_api from '@/lib/portal-api';
import type {
  PortalShipment,
  PortalShipmentDetail,
  PortalShipmentList,
} from '@/types/portal-shipment';

const BASE_URL = '/portal/shipments';

const listFetcher = async (url: string): Promise<PortalShipmentList> => {
  const response = await portal_api.get<PortalShipmentList>(url);
  return response.data;
};

const detailFetcher = async (url: string): Promise<PortalShipmentDetail> => {
  const response = await portal_api.get<{ shipment: PortalShipmentDetail }>(url);
  return response.data.shipment;
};

export const useMyShipments = () => {
  const { data, error, mutate } = useSWR<PortalShipmentList>(BASE_URL, listFetcher);
  return {
    shipments: (data?.items ?? []) as PortalShipment[],
    // Counts per state, computed backend-side. This is the only summary the
    // stored data supports — the GE control-tower KPIs (SLA em risco,
    // documentos pendentes) have no backing column and are not surfaced.
    byEstado: data?.by_estado ?? {},
    total: data?.total ?? 0,
    isLoading: !error && !data,
    isError: !!error,
    mutate,
  };
};

export const useMyShipment = (id: string | null) => {
  const { data, error, mutate } = useSWR<PortalShipmentDetail>(
    id ? `${BASE_URL}/${id}` : null,
    detailFetcher,
  );
  return {
    shipment: data,
    isLoading: !!id && !error && !data,
    isError: !!error,
    mutate,
  };
};
