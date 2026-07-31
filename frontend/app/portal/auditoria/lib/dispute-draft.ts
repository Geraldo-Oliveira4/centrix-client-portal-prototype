// Camada 3 — rascunho de contestação.
//
// TEMPLATE DETERMINÍSTICO: interpolação de string, nenhuma chamada de IA. É a
// única das três camadas que não depende do módulo de Tracking (o texto se
// escreve a partir da divergência, venha ela de exemplo ou de dado real), então
// é a que pode virar produto primeiro — trocando só a fonte dos números.
//
// Mantenha esta função pura e sem fetch: o dia em que a redação passar por um
// modelo, o template determinístico continua sendo o fallback.

import { formatBRL } from '@/lib/portal-formatters';

import type { ConciliationExample, EvaluatedLine } from './conciliation';

export interface DisputeDraft {
  to: string;
  subject: string;
  body: string;
}

const formatValue = (value: number, kind: EvaluatedLine['kind']): string =>
  kind === 'currency'
    ? formatBRL(value)
    : `${value} ${value === 1 ? 'dia' : 'dias'}`;

export function buildDisputeDraft(
  example: ConciliationExample,
  line: EvaluatedLine,
): DisputeDraft {
  const planned = formatValue(line.planned, line.kind);
  const realized = formatValue(line.realized, line.kind);
  const difference = formatValue(Math.abs(line.difference), line.kind);
  const signal = line.difference > 0 ? 'acima' : 'abaixo';

  const body = [
    `Prezados, ${example.agent},`,
    '',
    `Na conferência do embarque ${example.reference} (${example.route}) identificamos uma divergência no item "${line.item}" entre o que foi contratado na cotação e o que consta no fechamento.`,
    '',
    `Item: ${line.item}`,
    `Planejado (cotação): ${planned}`,
    `Realizado (NF final): ${realized}`,
    `Diferença: ${difference} (${line.variationPct > 0 ? '+' : ''}${line.variationPct}% ${signal} do contratado)`,
    '',
    'Solicitamos a revisão do valor cobrado ou o detalhamento que justifique a diferença. Seguimos à disposição para conciliar a documentação do embarque.',
    '',
    'Atenciosamente,',
    'Equipe de importação',
  ].join('\n');

  return {
    to: example.agent,
    subject: `Contestação — ${example.reference} · ${line.item}`,
    body,
  };
}
