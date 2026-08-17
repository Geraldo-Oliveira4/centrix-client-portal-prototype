// Documentos do embarque — a lista que a tela de detalhe mostra na seção
// "Documentos". Pura e unit-testada (shipment-documents.test.ts).
//
// Por que existe
// --------------
// O detalhe do embarque não tinha nenhuma área de arquivos: BL, invoice e
// packing list simplesmente não apareciam para o cliente. Esta é a estrutura
// dessa área, com dado ILUSTRATIVO — não há tabela de documento de embarque
// neste repositório (o módulo GE do analista tem `EmbarqueDocumento`, mas
// nenhum handler do portal o expõe).
//
// Compatibilidade com a Aprovação Documental (o que não fechar as portas)
// -----------------------------------------------------------------------
// O shape aqui é o que aquele módulo vai devolver, não o que é conveniente
// desenhar: `type` é um CÓDIGO estável (não o rótulo em português, que é
// apresentação e muda), `status` tem os três estados que uma aprovação
// documental precisa distinguir (pendente / em análise / aprovado) e `source`
// diz de quem é a obrigação — é isso que decide se o cliente vê um botão de
// envio ou só de download. Quando o dado real existir, troca-se o builder por
// um fetch e o resto da tela continua igual.
//
// Progresso, sem uma segunda tabela de etapas
// -------------------------------------------
// Que documentos já existem depende de onde o embarque está, e a resposta para
// isso já é dada pela timeline (`buildTimelineSteps`). Por isso o builder
// recebe os PASSOS prontos em vez de reimplementar a ordem dos estados: duas
// listas de etapas divergiriam no primeiro estado acrescentado a uma delas.
// Num embarque em exceção nenhum passo está concluído (a linha congela) e o
// piso é a abertura do processo — os documentos do cliente continuam visíveis,
// todos no estágio mais cedo, que é exatamente o que se sabe.

import type { StepStatus } from './timeline-steps';
// Mesmo gerador determinístico que os blocos de Inteligência usam. Importado em
// vez de recopiado: uma terceira implementação do mesmo hash é uma a mais para
// divergir. O import traz a extensão porque o runner nativo do Node não resolve
// caminho relativo sem ela (mesma razão de `shipment-dimensions.ts`).
import { seededInt } from '../../inteligencia/lib/intel-helpers.ts';

export type ShipmentDocumentType =
  | 'INVOICE'
  | 'PACKING_LIST'
  | 'BOOKING_CONFIRMATION'
  | 'DRAFT_BL'
  | 'BL'
  | 'CERTIFICADO_ORIGEM';

/**
 * Três estados, porque uma aprovação documental precisa distinguir os três:
 * `pendente` (falta o arquivo), `em_analise` (chegou, ninguém validou) e
 * `aprovado` (validado). Colapsar os dois últimos em "enviado" apagaria
 * justamente a etapa que dá nome ao módulo futuro.
 */
export type ShipmentDocumentStatus = 'pendente' | 'em_analise' | 'aprovado';

/** De quem é a obrigação de produzir o arquivo. */
export type ShipmentDocumentSource = 'cliente' | 'freitas';

export interface ShipmentDocument {
  id: string;
  /** Código estável do tipo — a chave que a integração vai casar. */
  type: ShipmentDocumentType;
  /** Rótulo de tela. Apresentação: nunca use isto como chave. */
  label: string;
  /** Null enquanto o arquivo não existe (status `pendente`). */
  fileName: string | null;
  status: ShipmentDocumentStatus;
  source: ShipmentDocumentSource;
  /** ISO. Null enquanto não há arquivo. */
  uploadedAt: string | null;
  sizeBytes: number | null;
  /**
   * Etapa da timeline que este documento destrava. É o que liga a seção
   * Documentos ao gatilho de ação da timeline: o passo que pede documento e o
   * documento que falta são o MESMO registro, não duas listas parecidas.
   */
  requiredForStep: string;
}

interface DocumentBlueprint {
  type: ShipmentDocumentType;
  label: string;
  source: ShipmentDocumentSource;
  requiredForStep: string;
  /** Passo que precisa ter sido ALCANÇADO para o documento existir na lista. */
  existsFrom: string;
  /** Passo que precisa ter sido CONCLUÍDO para o documento estar aprovado. */
  settledFrom: string;
  /** Dias após a abertura do processo em que o arquivo aparece. */
  uploadOffsetDays: number;
}

/**
 * O dossiê típico de uma importação marítima, na ordem em que os arquivos
 * aparecem na vida real. Não é catálogo: o Inova tem dezenas de tipos, e estes
 * são os que o cliente do portal efetivamente acompanha.
 */
const BLUEPRINTS: DocumentBlueprint[] = [
  {
    type: 'INVOICE',
    label: 'Commercial Invoice',
    source: 'cliente',
    requiredForStep: 'aguardando_prontidao',
    existsFrom: 'solicitado',
    settledFrom: 'aguardando_prontidao',
    uploadOffsetDays: 2,
  },
  {
    type: 'PACKING_LIST',
    label: 'Packing List',
    source: 'cliente',
    requiredForStep: 'aguardando_prontidao',
    existsFrom: 'solicitado',
    settledFrom: 'aguardando_prontidao',
    uploadOffsetDays: 2,
  },
  {
    type: 'BOOKING_CONFIRMATION',
    label: 'Booking confirmado',
    source: 'freitas',
    requiredForStep: 'analise_booking',
    existsFrom: 'analise_booking',
    settledFrom: 'analise_booking',
    uploadOffsetDays: 6,
  },
  {
    type: 'DRAFT_BL',
    label: 'Draft do BL',
    source: 'freitas',
    requiredForStep: 'embarcado',
    existsFrom: 'embarcado',
    settledFrom: 'embarcado',
    uploadOffsetDays: 9,
  },
  {
    type: 'BL',
    label: 'Bill of Lading (BL)',
    source: 'freitas',
    requiredForStep: 'chegada',
    existsFrom: 'embarcado',
    settledFrom: 'em_transito',
    uploadOffsetDays: 12,
  },
  {
    type: 'CERTIFICADO_ORIGEM',
    label: 'Certificado de Origem',
    source: 'cliente',
    requiredForStep: 'chegada',
    // Só passa a ser cobrado quando a carga está a caminho: antes do embarque
    // ele ainda não é uma pendência do cliente, é papel do exportador emitir.
    existsFrom: 'embarcado',
    settledFrom: 'chegada',
    uploadOffsetDays: 14,
  },
];

const DAY_MS = 86_400_000;

const STATUS_WEIGHT: Record<ShipmentDocumentStatus, number> = {
  pendente: 0,
  em_analise: 1,
  aprovado: 2,
};

/** Nome de arquivo derivado do tipo — determinístico, nunca sorteado. */
function fileNameFor(type: ShipmentDocumentType, referencia: string): string {
  return `${type.toLowerCase().replace(/_/g, '-')}-${referencia}.pdf`;
}

/**
 * Pendências primeiro, depois o mais recente. Uma função só, porque o builder e
 * a projeção local (`applyLocalDocumentActions`) precisam produzir a MESMA
 * ordem: um documento que muda de status tem de andar na lista igual a como
 * teria andado se o backend já soubesse dele.
 */
function sortDocuments(documents: ShipmentDocument[]): ShipmentDocument[] {
  return [...documents].sort(
    (a, b) =>
      STATUS_WEIGHT[a.status] - STATUS_WEIGHT[b.status] ||
      (b.uploadedAt ?? '').localeCompare(a.uploadedAt ?? '') ||
      a.label.localeCompare(b.label),
  );
}

export interface ShipmentDocumentsInput {
  referencia: string;
  /** Abertura do processo (ISO) — âncora de toda data de upload. */
  createdAt: string;
  /** Passos da timeline, na ordem, como `buildTimelineSteps` os devolve. */
  steps: { key: string; status: StepStatus }[];
  /** "Hoje". Injetado nos testes; nenhuma data de upload passa daqui. */
  now: Date;
}

/**
 * Documentos do embarque, do mais pendente ao mais antigo já aprovado.
 * Determinístico: mesmo embarque, mesma lista — nada aqui sorteia nada em
 * tempo de render.
 */
export function buildShipmentDocuments({
  referencia,
  createdAt,
  steps,
  now,
}: ShipmentDocumentsInput): ShipmentDocument[] {
  const order = steps.map((s) => s.key);
  const rank = (key: string) => order.indexOf(key);

  // Último passo alcançado (concluído ou atual) e último concluído. Em exceção
  // não há nenhum dos dois: o piso é a abertura do processo, porque ela
  // aconteceu — o que se perdeu foi a certeza sobre o que veio depois.
  let reachedIndex = 0;
  let passedIndex = -1;
  steps.forEach((step, index) => {
    if (step.status === 'done' || step.status === 'current') reachedIndex = index;
    if (step.status === 'done') passedIndex = index;
  });

  const opened = new Date(createdAt);
  const openedTime = Number.isNaN(opened.getTime()) ? now.getTime() : opened.getTime();

  return sortDocuments(
    BLUEPRINTS.filter((bp) => rank(bp.existsFrom) <= reachedIndex).map((bp) => {
      const settled = rank(bp.settledFrom) <= passedIndex;
      const status: ShipmentDocumentStatus = settled
        ? 'aprovado'
        : bp.source === 'freitas'
          ? 'em_analise'
          : 'pendente';

      const hasFile = status !== 'pendente';
      // A data do arquivo nunca é futura: um documento "enviado amanhã" seria a
      // única data da tela que o cliente consegue provar que está errada.
      const uploadedAt = hasFile
        ? new Date(
            Math.min(openedTime + bp.uploadOffsetDays * DAY_MS, now.getTime()),
          ).toISOString()
        : null;

      return {
        id: `${referencia}:${bp.type}`,
        type: bp.type,
        label: bp.label,
        fileName: hasFile ? fileNameFor(bp.type, referencia) : null,
        status,
        source: bp.source,
        uploadedAt,
        sizeBytes: hasFile
          ? seededInt(`${referencia}:${bp.type}`, 92_000, 3_400_000)
          : null,
        requiredForStep: bp.requiredForStep,
      };
    }),
  );
}

export interface LocalDocumentActionsInput {
  documents: ShipmentDocument[];
  referencia: string;
  /** Ids que o cliente "enviou" pelo modal nesta sessão. */
  submittedIds: string[];
  /** O cliente aprovou o booking pelo modal nesta sessão. */
  bookingApproved: boolean;
  /** "Agora" — a data que o arquivo simulado carrega. Injetado nos testes. */
  now: Date;
}

/**
 * Projeta na lista o que o cliente acabou de fazer NA TELA.
 *
 * Por que isto existe, e por que é uma camada separada
 * ----------------------------------------------------
 * O portal não escreve no embarque — nenhuma rota de escrita do GE foi copiada
 * para cá — mas uma demonstração ao vivo em que aprovar não muda nada na tela
 * não demonstra o fluxo, demonstra um beco. Então o efeito é LOCAL: o builder
 * acima continua sendo a única fonte do estado "de verdade" e não sabe nada de
 * clique; esta função aplica por cima o que a sessão viu acontecer. Quando a
 * Aprovação Documental existir, ela sai inteira e o builder vira um fetch.
 *
 * O avanço é sempre de UM degrau na máquina de três estados, nunca um salto:
 * enviar deixa o documento `em_analise` (chegou, ninguém validou ainda) e é a
 * conferência da Freitas que o levaria a `aprovado`. Pular direto para
 * "Aprovado" no clique do próprio cliente apagaria a etapa que dá nome ao
 * módulo futuro.
 */
export function applyLocalDocumentActions({
  documents,
  referencia,
  submittedIds,
  bookingApproved,
  now,
}: LocalDocumentActionsInput): ShipmentDocument[] {
  if (submittedIds.length === 0 && !bookingApproved) return documents;

  const submitted = new Set(submittedIds);

  return sortDocuments(
    documents.map((doc): ShipmentDocument => {
      if (doc.status === 'pendente' && submitted.has(doc.id)) {
        return {
          ...doc,
          status: 'em_analise',
          fileName: fileNameFor(doc.type, referencia),
          uploadedAt: now.toISOString(),
          sizeBytes: seededInt(`${referencia}:${doc.type}`, 92_000, 3_400_000),
        };
      }
      // Aprovar o booking é validar o booking confirmado: é o mesmo ato, e
      // deixar o documento em análise depois do "sim" faria a seção Documentos
      // contradizer a faixa de ação logo acima dela.
      if (
        bookingApproved &&
        doc.type === 'BOOKING_CONFIRMATION' &&
        doc.status === 'em_analise'
      ) {
        return { ...doc, status: 'aprovado' };
      }
      return doc;
    }),
  );
}

/**
 * Os documentos que a bola está com o CLIENTE. É a entrada do gatilho de ação
 * da timeline — o que a seção Documentos mostra como pendente é exatamente o
 * que a etapa cobra, porque sai daqui.
 */
export function pendingClientDocuments(
  documents: ShipmentDocument[],
): ShipmentDocument[] {
  return documents.filter((d) => d.status === 'pendente' && d.source === 'cliente');
}

/** "1,2 MB" / "840 KB". Null vira "—" no chamador, não aqui. */
export function formatFileSize(bytes: number): string {
  if (bytes >= 1_000_000) {
    return `${(bytes / 1_000_000).toLocaleString('pt-BR', {
      maximumFractionDigits: 1,
    })} MB`;
  }
  return `${Math.round(bytes / 1000)} KB`;
}
