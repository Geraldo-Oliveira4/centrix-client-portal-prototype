/**
 * "Solicitar cotação com esta rota e data" (Simulador v2, S8, 17/11/2026): a
 * ponta da Nova Cotação. O Simulador (iframe, `intel-sim.js::quotationLink`)
 * escreve a query; esta função a lê e devolve o pré-preenchimento.
 *
 * Só entra o que o cliente DEFINIU na simulação: modal, origem, destino e a
 * data-alvo (no campo "Quando você precisa da carga no destino"). Nenhum agente
 * de carga é pré-selecionado: o Simulador compara, não escolhe. Os nomes de
 * porto viajam em português e são traduzidos pela MESMA tabela do Radar
 * (`QUOTATION_PORT_OPTION`), para não haver uma segunda tabela de portos.
 *
 * PURO (roda sob `node --test`). Parâmetro desconhecido ou inválido é ignorado:
 * a barra de endereço é pública.
 */
import { QUOTATION_DESTINATION_OPTION, QUOTATION_PORT_OPTION } from './price-radar.ts';

export const SIMULATOR_SOURCE = 'simulador';
export const SIM_QUOTE_PARAMS = {
  source: 'fonte',
  modal: 'modal',
  origin: 'origem_rota',
  destination: 'destino_rota',
  date: 'data_necessidade',
  label: 'rota',
} as const;

const MODALS = new Set(['MARITIMO', 'AEREO', 'RODOVIARIO']);
const ISO = /^\d{4}-\d{2}-\d{2}$/;

export interface SimulatorPrefill {
  values: {
    modal?: 'MARITIMO' | 'AEREO' | 'RODOVIARIO';
    porto_embarque?: string;
    porto_destino?: string[];
    data_limite_necessidade?: string;
  };
  routeLabel: string | null;
}

/** `null` quando o link não veio do Simulador. */
export function simulatorPrefill(params: URLSearchParams): SimulatorPrefill | null {
  if (params.get(SIM_QUOTE_PARAMS.source) !== SIMULATOR_SOURCE) return null;
  const values: SimulatorPrefill['values'] = {};
  const modal = params.get(SIM_QUOTE_PARAMS.modal);
  if (modal && MODALS.has(modal)) values.modal = modal as SimulatorPrefill['values']['modal'];
  // Portos só no marítimo: o formulário separa porto e aeroporto, e a tabela
  // conhece portos. No aéreo entram só o modal e a data.
  if (values.modal === 'MARITIMO') {
    const origin = QUOTATION_PORT_OPTION[params.get(SIM_QUOTE_PARAMS.origin) ?? ''];
    const destination = QUOTATION_DESTINATION_OPTION[params.get(SIM_QUOTE_PARAMS.destination) ?? ''];
    if (origin) values.porto_embarque = origin;
    if (destination) values.porto_destino = [destination];
  }
  const date = params.get(SIM_QUOTE_PARAMS.date);
  if (date && ISO.test(date) && !Number.isNaN(Date.parse(date))) values.data_limite_necessidade = date;
  return { values, routeLabel: Object.keys(values).length ? params.get(SIM_QUOTE_PARAMS.label) : null };
}
