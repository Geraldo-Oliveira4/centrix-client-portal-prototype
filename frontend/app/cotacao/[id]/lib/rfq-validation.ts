import type { ValidationBlock } from '@/types/quotation';

export const VALIDATION_FIELD_LABELS: Record<string, string> = {
  client_id: 'Cliente',
  origin: 'Local de coleta (origem)',
  incoterm: 'Incoterm',
  include_insurance: 'Seguro',
  product: 'Produto / Mercadoria',
  stackability: 'Empilhável',
  declared_value: 'Valor Declarado',
  imo_class: 'Classe IMO',
  un_number: 'Número ONU',
  carga_perigosa: 'Carga Perigosa',
  modal: 'Modal',
  validity: 'Prazo Desejado',
  endereco_entrega_final: 'Endereço de entrega final',
  porto_destino: 'Porto de destino',
  aeroporto_destino: 'Aeroporto de destino',
  porto_embarque: 'Porto de embarque',
  aeroporto_embarque: 'Aeroporto de embarque',
  temperatura_min: 'Temperatura mínima (carga refrigerada)',
  temperatura_max: 'Temperatura máxima (carga refrigerada)',
  tipo_container_fcl: 'Tipo de container (FCL)',
  necessidade_descarga: 'Necessidade de descarga',
  ncm: 'NCM',
};

export function isDispatchBlocked(hardBlocks: ValidationBlock[]): boolean {
  return hardBlocks.length > 0;
}

export function getBlockSummary(
  hardBlocks: ValidationBlock[],
  softWarnings: ValidationBlock[],
): string {
  const parts: string[] = [];
  if (hardBlocks.length > 0) {
    const n = hardBlocks.length;
    parts.push(`${n} bloqueio${n > 1 ? 's' : ''} crítico${n > 1 ? 's' : ''}`);
  }
  if (softWarnings.length > 0) {
    const n = softWarnings.length;
    parts.push(`${n} aviso${n > 1 ? 's' : ''}`);
  }
  return parts.join(' · ');
}

export function resolveLabel(block: ValidationBlock): string {
  return block.label || VALIDATION_FIELD_LABELS[block.field] || block.field;
}
