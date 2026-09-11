// Layout da Home (`/portal/home`): temas escolhidos e cards ligados.
//
// Chave SWR e endpoint PROPRIOS: isto nao passa por `/portal/preferences` nem
// compartilha cache com `use-portal-agents.ts`. Ver a docstring de
// `backend/app/home_layout_experiment.py`.

import useSWR from 'swr';
import { toast } from 'react-toastify';

import portal_api from '@/lib/portal-api';
import type {
  PortalHomeLayout,
  PortalHomeLayoutResponse,
  SaveHomeLayoutPayload,
} from '@/types/portal-home-layout';

const LAYOUT_URL = '/portal/home-layout-experiment';

const fetcher = async (url: string): Promise<PortalHomeLayoutResponse> => {
  const response = await portal_api.get<PortalHomeLayoutResponse>(url);
  return response.data;
};

export const useMyHomeLayout = () => {
  const { data, error, mutate } = useSWR<PortalHomeLayoutResponse>(
    LAYOUT_URL,
    fetcher,
  );
  return {
    // `undefined` = ainda carregando; `null` = carregou e o cliente nunca
    // onboardou. A tela precisa dos dois: so o segundo abre o modal, e
    // confundi-los faria o onboarding piscar em cima de quem ja escolheu.
    layout: data ? data.layout : undefined,
    isLoading: !error && !data,
    isError: !!error,
    mutate,
  };
};

/**
 * Grava o layout inteiro. Como toda mutation do portal, nao propaga excecao —
 * devolve o layout salvo ou null.
 */
export const saveMyHomeLayout = async (
  payload: SaveHomeLayoutPayload,
  mutate: (data?: PortalHomeLayoutResponse) => void,
): Promise<PortalHomeLayout | null> => {
  try {
    const response = await portal_api.put<PortalHomeLayoutResponse>(
      LAYOUT_URL,
      payload,
    );
    mutate(response.data);
    return response.data.layout;
  } catch {
    toast.error('Erro ao salvar a personalização da Home.');
    return null;
  }
};

/** "Refazer personalização do zero": apaga a linha e reabre o onboarding. */
export const resetMyHomeLayout = async (
  mutate: (data?: PortalHomeLayoutResponse) => void,
): Promise<boolean> => {
  try {
    await portal_api.delete(LAYOUT_URL);
    mutate({ layout: null });
    return true;
  } catch {
    toast.error('Erro ao refazer a personalização.');
    return false;
  }
};
