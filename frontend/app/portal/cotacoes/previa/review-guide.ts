import type { scenarios } from './model';

export const reviewGroups = [
  {
    title: '1. Preencher detalhes',
    items: [
      {
        id: 'rascunho',
        check:
          'Preencha peso e volume. Revise a solicitação antes de enviar aos agentes.',
      },
      {
        id: 'complementar',
        check:
          'Veja o pedido da Freitas, os campos pendentes e a preservação dos dados já informados.',
      },
      {
        id: 'envio',
        check:
          'Dados já preenchidos. Clique em Revisar solicitação para conferir os agentes e confirmar o envio.',
      },
    ],
  },
  {
    title: '2. Aguardar agentes',
    items: [
      {
        id: 'aguardando',
        check:
          'Nenhuma resposta: confira destinatários, prazo de retorno e pedido de atualização à Freitas.',
      },
      {
        id: 'parciais',
        check:
          'Uma proposta recebida. Consulte suas condições; a escolha aguarda liberação. Use Simular para receber as demais.',
      },
    ],
  },
  {
    title: '3. Escolher uma proposta',
    items: [
      {
        id: 'comparar',
        check:
          'Compare ofertas, necessidade de chegada, mercado e Raio X. A escolha segue para análise.',
      },
      {
        id: 'vencidas',
        check:
          'Propostas vencidas: seleção bloqueada, com acesso aos detalhes para pedir revisão.',
      },
      {
        id: 'sem-dados',
        check:
          'Sem validade, chegada ou necessidade informadas: a tela não inventa recomendação.',
      },
      {
        id: 'devolvida',
        check:
          'A Freitas devolveu a escolha. Leia o motivo e selecione uma nova condição.',
      },
    ],
  },
  {
    title: '4. Depois da escolha',
    items: [
      {
        id: 'analise',
        check:
          'Escolha enviada para a Freitas. Em Simular, libere ou devolva a condição.',
      },
      {
        id: 'liberada',
        check:
          'Condição liberada. Confira o resumo da instrução; em Simular, confirme a contratação.',
      },
      {
        id: 'fechada',
        check: 'Veja a condição contratada e o resumo do vínculo ao embarque.',
      },
      {
        id: 'recusada',
        check: 'Cliente recusou as propostas; motivo preservado no histórico.',
      },
      {
        id: 'cancelada',
        check:
          'Solicitação cancelada; motivo preservado e próxima ação explícita.',
      },
    ],
  },
] satisfies {
  title: string;
  items: { id: (typeof scenarios)[number][0]; check: string }[];
}[];
