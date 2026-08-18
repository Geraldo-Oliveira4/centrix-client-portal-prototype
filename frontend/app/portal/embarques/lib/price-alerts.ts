// Notificação de preço no feed de Alertas — a ponte entre o Radar de Preços e o
// mecanismo de aviso que já existe em Meus Embarques. Puro e unit-testado
// (price-alerts.test.ts), como todo lib desta pasta que decide alguma coisa.
//
// Por que existe
// --------------
// O Victor Orsi pediu o Radar para "notificar clientes sobre flutuações nas
// rotas preferidas". O que foi construído até aqui é um painel PASSIVO: o
// cliente só descobre a janela se lembrar de abrir a aba, e quem lembra de
// abrir uma aba de preço todo dia já tem quem acompanhe preço. Este módulo
// fecha essa distância usando o canal que já existe, em vez de inventar um
// segundo: a mesma lista de notificações, o mesmo desenho, as mesmas
// preferências de tipo, o mesmo "marcar como lida".
//
// O que é real e o que é ilustrativo
// -----------------------------------
// Herda exatamente a divisão do Radar (`inteligencia/lib/price-radar.ts`): a
// ROTA é real (sai dos embarques do cliente), o número em dinheiro é
// ilustrativo. Este módulo não calcula nem reformula nada — recebe a rota já
// classificada e a transforma em entrada de feed. Se a classificação mudar, o
// alerta muda junto, porque a fonte é uma só.
//
// Sem selo de proveniência, seguindo a filosofia vigente do protótipo para as
// partes novas (dado ilustrativo rico) e o que a própria tela do Radar já faz.

import type { PriceRadarRoute } from '../../inteligencia/lib/price-radar.ts';
import type { AlertType, ShipmentAlert } from './shipment-alerts.ts';

/** Onde a notificação leva. O card específico não existe: o Radar é uma grade. */
export const RADAR_HREF = '/portal/inteligencia/radar';

/** O tipo de alerta que este módulo produz, nomeado uma vez. */
export const PRICE_ALERT_TYPE: AlertType = 'preco';

/**
 * Os dois extremos que viram notificação, e por que só eles.
 *
 * `atencao` é, por definição, "oscilação dentro do normal da rota — sem urgência
 * para antecipar ou adiar". Notificar isso seria avisar que nada mudou, e três
 * avisos desses ensinam o cliente a desligar o toggle antes do primeiro aviso
 * que importava. O alerta existe para o momento em que a resposta a "cotar agora
 * ou esperar?" MUDA.
 */
export const ALERTABLE_PRICE_TYPES = ['oportunidade', 'alta'] as const;

/**
 * Quantas rotas de cada extremo entram no feed.
 *
 * Uma de cada, e não todas: a carteira do cliente costuma ter duas ou três rotas
 * em cada regime, e seis entradas de preço afogariam os alertas de embarque —
 * que são os que têm carga andando. O feed é a cutucada; a lista completa está a
 * um clique, no Radar, que é justamente para onde o link aponta.
 */
export const MAX_PER_PRICE_TYPE = 1;

const TONE = {
  // Verde e vermelho como no card do Radar: preço abaixo da média é bom para
  // quem compra frete, acima é ruim. Não é o semáforo de saúde do embarque.
  oportunidade: 'success',
  alta: 'danger',
} as const;

export interface PriceAlertInput {
  /**
   * Rotas já classificadas por `computePriceRadar`, e as MESMAS que a tela do
   * Radar mostra — mesmo `limit` incluído.
   *
   * Não é detalhe: a notificação termina em "Ver no Radar de Preços", e avisar
   * sobre uma rota que a grade do Radar não exibe entregaria o cliente numa
   * tela onde ele não acha o que foi avisado. O corte do Radar também é o
   * critério certo aqui — ele existe para separar "rota preferida" de rota de
   * uma carga só, e rota de uma carga só não justifica interromper ninguém.
   */
  routes: PriceRadarRoute[];
  /**
   * Quando a leitura foi feita, em ISO 8601.
   *
   * É a única data do feed que não é lida de um embarque, e ela é honesta pelo
   * mesmo motivo que as outras: a janela do Radar é móvel e termina HOJE (mediana
   * dos últimos 90 dias), então a leitura é corrente por construção. Vem por
   * parâmetro em vez de `new Date()` aqui dentro para o módulo continuar puro e
   * o teste conseguir fixá-la.
   */
  observedAt: string;
}

/**
 * As notificações de preço do feed. Determinístico: mesmas rotas e mesma data
 * de leitura -> mesmas entradas, com id estável (`radar:<rota>`) para o "já li"
 * sobreviver ao refresh. O id NÃO carrega a data justamente por isso — se
 * carregasse, cada visita ressuscitaria o alerta como não lido.
 */
export function buildPriceAlerts({
  routes,
  observedAt,
}: PriceAlertInput): ShipmentAlert[] {
  return ALERTABLE_PRICE_TYPES.flatMap((type) =>
    routes
      .filter((route) => route.alert.type === type)
      // O extremo mais forte primeiro: entre duas oportunidades, a de maior
      // desconto; entre duas altas, a de maior alta. `variationPct` é negativo
      // na oportunidade, então a mesma ordenação por distância da média serve
      // para os dois lados.
      .sort((a, b) => Math.abs(b.variationPct) - Math.abs(a.variationPct))
      .slice(0, MAX_PER_PRICE_TYPE)
      .map((route) => ({
        id: `radar:${route.id}`,
        type: PRICE_ALERT_TYPE,
        tone: TONE[type],
        subject: `${route.origin} → ${route.destination}`,
        // Sem `shipmentId`: o alerta é da ROTA, não de uma carga. Ver o campo
        // em `shipment-alerts.ts`.
        link: { href: RADAR_HREF, label: 'Ver no Radar de Preços' },
        // Título e texto vêm do MESMO alerta que o card do Radar imprime
        // (`route.alert.label` / `.rationale`). Escrever uma segunda frase aqui
        // criaria duas explicações para o mesmo número, e elas divergiriam no
        // primeiro ajuste de limiar.
        title: `${route.alert.label} de preço — ${route.origin} → ${route.destination}`,
        description: route.alert.rationale,
        timestamp: observedAt,
      })),
  );
}
