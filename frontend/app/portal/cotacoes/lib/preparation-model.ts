import type { PortalQuotation } from '../../../../types/portal';
import type { ManualFormDraft } from '../../../cotacao/nova-cotacao/components/manual-form';
import { repeatQuotation } from './repeat-model.ts';

// Editing an existing request preserves occurrence data; repeating it does not.
export function editableQuotation(source: PortalQuotation) {
  const base = repeatQuotation(source);
  const values = {
    ...base.manualDraft!.values,
    ...Object.fromEntries(
      Object.entries(source).filter(([, value]) => value != null),
    ),
  } as ManualFormDraft['values'];
  for (const key of [
    'stackability',
    'carga_tombavel',
    'insurance_required',
  ] as const)
    values[key] = source[key] == null ? '' : source[key] ? 'true' : 'false';
  values.declared_value =
    source.declared_value == null ? '' : String(source.declared_value);
  values.temperatura_min =
    source.temperatura_min == null ? '' : String(source.temperatura_min);
  values.temperatura_max =
    source.temperatura_max == null ? '' : String(source.temperatura_max);
  const withoutNulls = <T extends object>(item: T) =>
    Object.fromEntries(
      Object.entries(item).filter(([, value]) => value != null),
    );
  return {
    ...base,
    id: source.id,
    reference: source.reference,
    po: source.client_reference || '',
    readyDate: source.data_prontidao || '',
    needDate: source.data_limite_necessidade || '',
    weight: String(source.totals?.weight_kg || ''),
    volume: String(source.totals?.volume_m3 || ''),
    manualDraft: {
      ...base.manualDraft!,
      values: structuredClone(values),
      equipments: (source.equipments || []).map((item) =>
        withoutNulls(item),
      ) as ManualFormDraft['equipments'],
      volumes: (source.volumes || []).map((item) =>
        withoutNulls(item),
      ) as ManualFormDraft['volumes'],
    },
  };
}
export const usesPreparationDetail = (state: string) =>
  ['AGUARDANDO_DADOS', 'TRIAGEM_IA', 'COTANDO', 'PARA_ANALISE'].includes(state);
export const mergeInvitations = (existing: string[], additional: string[]) =>
  Array.from(new Set([...existing, ...additional]));
