import type { PortalQuotation } from '../../../../types/portal';
import type { ManualFormDraft } from '../../../cotacao/nova-cotacao/components/manual-form';
import type { Quote } from '../previa/model';
import { reusableDraft, startRequest } from '../previa-habituais/model.ts';

export type LocalRequest = {
  id: string;
  sourceId: string;
  sourceReference: string;
  updatedAt: string;
  stage: 'draft' | 'waiting';
  quote: Quote;
  agents: string[];
};

export function repeatQuotation(source: PortalQuotation): Quote {
  // Normalize only stable source fields; transaction data is removed by the shared allow-list.
  const values = Object.fromEntries(
    Object.entries(source).filter(([, value]) => value != null),
  ) as ManualFormDraft['values'];
  for (const key of [
    'stackability',
    'carga_tombavel',
    'insurance_required',
  ] as const) {
    values[key] = source[key] == null ? '' : source[key] ? 'true' : 'false';
  }
  values.temperatura_min =
    source.temperatura_min == null ? '' : String(source.temperatura_min);
  values.temperatura_max =
    source.temperatura_max == null ? '' : String(source.temperatura_max);
  const draft = reusableDraft({
    values,
    equipments: [],
    volumes: [],
    flags: {
      showRefrigerada:
        source.temperatura_min != null || source.temperatura_max != null,
    },
  });
  const blank = startRequest(null);
  return {
    ...blank,
    supplier: source.exporter_name || '',
    product: source.product || '',
    pickup: source.origin || '',
    origin:
      source.porto_embarque ||
      source.aeroporto_embarque ||
      source.origin ||
      'Origem a confirmar',
    destination:
      source.porto_destino?.join(', ') ||
      source.aeroporto_destino?.join(', ') ||
      'Destino a confirmar',
    incoterm: source.incoterm || '',
    equipment: source.tipo_embarque || '',
    manualDraft: {
      ...draft,
      values: { ...blank.manualDraft!.values, ...draft.values },
    },
  };
}
export function upsertRequest(rows: LocalRequest[], request: LocalRequest) {
  return [...rows.filter((row) => row.id !== request.id), request];
}
export function requestIssue(q: Quote, now = Date.now()) {
  if (!q.supplier.trim() || !q.product.trim())
    return 'Informe fornecedor e mercadoria.';
  if (!q.manualDraft?.values.modal || !q.manualDraft.values.incoterm)
    return 'Informe modal e Incoterm.';
  if (!(Number(q.weight) > 0) || !(Number(q.volume) > 0))
    return 'Informe os equipamentos ou volumes com peso e volume positivos.';
  const {
    data_prontidao: ready,
    data_limite_necessidade: need,
    desired_deadline: deadline,
  } = q.manualDraft.values;
  if (!ready || !need || !deadline || !Number.isFinite(Date.parse(deadline)))
    return 'Informe prontidão, chegada necessária e prazo de resposta.';
  if (need < ready)
    return 'A chegada necessária deve ser posterior ou igual à prontidão.';
  if (Date.parse(deadline) <= now)
    return 'Informe um prazo de resposta futuro.';
  return null;
}
