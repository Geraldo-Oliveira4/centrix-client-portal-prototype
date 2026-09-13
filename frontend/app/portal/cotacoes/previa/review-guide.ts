import type { scenarios } from './model';

export const reviewGroups = [
  {
    title: '1. Preencher detalhes',
    items: [
      {
        id: 'programado',
        check:
          'Confira data, horário de Brasília e agentes destinatários. Edite ou cancele a programação mantendo o rascunho. Simulação sem envio automático.',
      },
      {
        id: 'rascunho',
        check:
          'Edite os dados preenchidos, complete peso e volume e use Continuar depois. Revisar não envia a solicitação.',
      },
      {
        id: 'complementar',
        check:
          'Veja os dados preservados e complete as dimensões da carga antes de revisar o envio.',
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
          'Nenhuma resposta: confira agentes convidados, prazo solicitado e a etapa atual. Atualizar consulta a situação.',
      },
      {
        id: 'parciais',
        check:
          'Abra Ver proposta, convide agentes ainda disponíveis e revise as ofertas recebidas sem esperar todos. Use Simular para novas respostas.',
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
