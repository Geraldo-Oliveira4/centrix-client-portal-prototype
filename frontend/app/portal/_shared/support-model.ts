// Ajuda e suporte (30/09/2026) — só visual: nada é enviado a ninguém.
//
// PURE, sem o alias `@/`: roda sob `npm run test:unit`.

/** Storage name under the demo prefix (`centrix-proto-v2:`). */
export const SUPPORT_SEQUENCE_STORE_NAME = 'support-protocol-seq';

/** "BUG-2026-0007". Sequencial neste navegador; o ano vem de quem chama. */
export function protocolFor(sequence: number, year: number): string {
  return `BUG-${year}-${String(Math.max(1, Math.floor(sequence))).padStart(4, '0')}`;
}

export function parseSequence(raw: string | null): number {
  const n = raw == null ? 0 : Number(JSON.parse(raw));
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

/**
 * O nome da tela em que o cliente está, para o relato de problema vir
 * preenchido. Prefixo mais específico ganha (`/portal/cotacoes` antes de
 * `/portal/cotacao/...`).
 */
const SCREENS: [string, string][] = [
  ['/portal/nova-cotacao', 'Nova cotação'],
  ['/portal/cotacoes', 'Minhas Cotações'],
  ['/portal/cotacao/', 'Detalhe da cotação'],
  ['/portal/embarques/novo', 'Novo embarque'],
  ['/portal/embarques', 'Meus Embarques'],
  ['/portal/visao-geral', 'Central de trabalho'],
  ['/portal/home', 'Início'],
  ['/portal/inteligencia', 'Inteligência'],
  ['/portal/radar', 'Radar'],
  ['/portal/auditoria', 'Auditoria'],
  ['/portal/preferencias', 'Configurações'],
];

export function screenName(pathname: string): string {
  let best: [string, string] | null = null;
  for (const entry of SCREENS) {
    if (
      pathname.startsWith(entry[0]) &&
      (!best || entry[0].length > best[0].length)
    ) {
      best = entry;
    }
  }
  return best ? `${best[1]} (${pathname})` : pathname;
}

/** Descrição mínima para enviar um relato: o suporte precisa entender o quê. */
export const REPORT_MIN_LENGTH = 10;

export function reportIssue(description: string): string | null {
  const length = description.trim().length;
  if (length === 0) return 'Conte o que aconteceu para enviar.';
  if (length < REPORT_MIN_LENGTH) {
    const missing = REPORT_MIN_LENGTH - length;
    return `Faltam ${missing} ${missing === 1 ? 'caractere' : 'caracteres'}: descreva o que você fez e o que apareceu.`;
  }
  return null;
}

/** A resposta ilustrativa do chat. Diz que é demonstração, sem prometer envio. */
export const SUPPORT_REPLY =
  'Obrigado! Um especialista do Centrix responde por aqui em até 15 minutos no horário comercial. (Demonstração: esta conversa não é enviada a ninguém.)';

export const SUPPORT_GREETING =
  'Olá! Aqui é o suporte do Centrix. Conte o que você está tentando fazer que a gente ajuda.';
