// Cliente Freitas x SaaS puro (Prompt 3, item B). Puro.
//
// SaaS puro é o cliente que usa o Centrix sem a operação da Freitas e sem a
// integração Inova: ninguém do outro lado completa um campo, lê um documento ou
// escolhe um agente por ele. A regra que as telas obedecem é uma só — NADA
// VEM PREENCHIDO SOZINHO — e este módulo é onde ela mora, para as quatro telas
// (Nova cotação, Fechamento direto, Embarque via PO e detalhe do embarque) não
// decidirem cada uma por conta própria.
//
// O que fica de fora, de propósito: QUEM revisa a cotação de um cliente SaaS
// puro. A revisão de entrada/saída continua como está (é lógica da Cotação V2,
// que este prompt não toca) e a pergunta está em FRONTEIRA-OPERACIONAL.md.

import type { ClientKind } from './access-model.ts';

export type DataSource =
  | 'voce'
  | 'sincronizado'
  | 'aguardando'
  | 'freitas'
  | 'nao_se_aplica';

export const DATA_SOURCE_LABELS: Record<DataSource, string> = {
  voce: 'Informado por você',
  sincronizado: 'Sincronizado',
  aguardando: 'Aguardando conferência',
  freitas: 'Preenchido pela Freitas',
  nao_se_aplica: 'Não se aplica',
};

export interface SourceLine {
  what: string;
  source: DataSource;
  note?: string;
}

/** Pode alguma coisa entrar preenchida (Radar, leitura de documento, agente da rota)? */
export function allowsAutoFill(kind: ClientKind): boolean {
  return kind === 'freitas';
}

export function quotationSources(kind: ClientKind): SourceLine[] {
  if (kind === 'freitas') {
    return [
      { what: 'Dados da carga', source: 'voce' },
      {
        what: 'Rota e modal vindos do Radar',
        source: 'freitas',
        note: 'quando você chega pelo "Cotar agora"',
      },
      {
        what: 'Documentos enviados',
        source: 'freitas',
        note: 'a Freitas lê e monta a cotação',
      },
    ];
  }
  return [
    {
      what: 'Dados da carga, rota e modal',
      source: 'voce',
      note: 'nada vem preenchido',
    },
    {
      what: 'Anexos',
      source: 'aguardando',
      note: 'ficam anexados; ninguém lê por você',
    },
  ];
}

export function directCloseSources(kind: ClientKind): SourceLine[] {
  if (kind === 'freitas') {
    return [
      {
        what: 'Rota e agente preferido',
        source: 'freitas',
        note: 'combinados com a Freitas',
      },
      { what: 'Dados do embarque', source: 'voce' },
    ];
  }
  return [
    {
      what: 'Rota e agente',
      source: 'voce',
      note: 'sem agente preferido combinado com a Freitas',
    },
    { what: 'Dados do embarque', source: 'voce' },
  ];
}

export function poSources(kind: ClientKind): SourceLine[] {
  if (kind === 'freitas') {
    return [
      {
        what: 'Dados do PO',
        source: 'freitas',
        note: 'lidos do documento; você confere',
      },
      { what: 'Arquivo do PO', source: 'voce' },
    ];
  }
  return [
    {
      what: 'Dados do PO',
      source: 'voce',
      note: 'sem leitura automática do documento',
    },
    { what: 'Arquivo do PO', source: 'aguardando' },
  ];
}

export function shipmentSources(kind: ClientKind): SourceLine[] {
  if (kind === 'freitas') {
    return [
      {
        what: 'Etapas operacionais (prontidão, coleta, booking)',
        source: 'freitas',
      },
      { what: 'Rastreamento da companhia', source: 'sincronizado' },
      { what: 'Documentos que você envia', source: 'voce' },
    ];
  }
  return [
    { what: 'Dados do embarque', source: 'voce' },
    {
      what: 'Rastreamento da companhia',
      source: 'sincronizado',
      note: 'vem do armador, não da Freitas',
    },
    { what: 'Documentos enviados', source: 'aguardando' },
    {
      what: 'Etapas operadas pela Freitas (prontidão, coleta, booking)',
      source: 'nao_se_aplica',
      note: 'sem operação da Freitas, ninguém atualiza esses marcos por você',
    },
  ];
}
