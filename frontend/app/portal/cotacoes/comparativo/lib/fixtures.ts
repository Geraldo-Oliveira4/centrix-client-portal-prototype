// As duas cotações do comparativo (06/10/2026).
//
// REPO PÚBLICO: TUDO AQUI É FICTÍCIO. Nenhum agente, armador, exportador,
// cliente, endereço, número de pedido ou de cotação real. Os agentes são os da
// fixture da Inteligência (Alpha Logistics, Beta Cargo, Gamma Freight, Delta
// Shipping, com os mesmos ids, para o Histórico do agente encontrá-los); Epsilon
// Cargo é fictício e propositalmente AUSENTE daquela fixture, para mostrar o
// estado "Sem histórico com este agente". Armadores são nomes inventados.
//
// DATAS RELATIVAS A HOJE. Validade e chegada são deslocamentos a partir do dia
// em que a tela abre: uma fixture com datas fixas apodreceria — em um mês toda
// proposta estaria vencida. Os testes fixam `today` e conferem os invariantes
// em vários dias da semana (dias úteis mudam com o dia).
//
// Os textos de observação trazem entidades HTML (`&#231;`, `&#199;`) de
// propósito: é como o dado real chega, e a tela tem de decodificar.

import {
  addDays,
  type ComparisonProposal,
  type ComparisonQuotation,
  type Currency,
} from './comparison-model.ts';

const PTAX: Record<Currency, number> = { USD: 5.42, EUR: 5.89, BRL: 1 };

const usd = (label: string, amount: number) => ({ label, currency: 'USD' as const, amount });
const eur = (label: string, amount: number) => ({ label, currency: 'EUR' as const, amount });
const brl = (label: string, amount: number) => ({ label, currency: 'BRL' as const, amount });

export const DEMO_REFERENCE_A = 'COT-DEMO-0417';
export const DEMO_REFERENCE_B = 'COT-DEMO-0388';

/** COT-DEMO-A: LCL, cinco propostas, moedas misturadas, seguro não exigido. */
function quotationA(today: string): ComparisonQuotation {
  const base = {
    shipmentType: 'LCL' as const,
    incoterm: 'FOB',
    portOfLoading: 'Ningbo, China',
    portOfDischarge: 'Itajaí, SC',
    highAuditPending: false,
    insurance: null,
    insuranceIncluded: false,
  };
  const proposals: ComparisonProposal[] = [
    {
      ...base,
      id: 'a-alpha-1',
      agentId: 'alpha',
      agentName: 'Alpha Logistics',
      route: 'direta',
      transshipment: null,
      frequency: 'semanal',
      freeTimeDays: 7,
      transitDays: 38,
      departureInDays: 5,
      carrier: 'Linha Atlântica Demo',
      validUntil: addDays(today, 15),
      originCharges: [usd('Handling', 60), usd('Documentação', 25)],
      freightCharges: [usd('Frete marítimo LCL', 240)],
      destinationCharges: [brl('Desconsolidação', 650), brl('THC destino', 500)],
      observations:
        'Sa&#237;da semanal direta. Armazenagem no terminal de destino n&#227;o inclu&#237;da.',
      documents: [{ name: 'Proposta_Alpha_Opcao1.pdf', kind: 'pdf' }],
    },
    {
      ...base,
      id: 'a-alpha-2',
      agentId: 'alpha',
      agentName: 'Alpha Logistics',
      route: 'transbordo',
      transshipment: 'Singapura',
      frequency: 'quinzenal',
      freeTimeDays: 7,
      transitDays: 46,
      departureInDays: 9,
      carrier: 'Oceano Sul Lines',
      validUntil: addDays(today, 10),
      originCharges: [usd('Handling', 60), usd('Documentação', 25)],
      freightCharges: [usd('Frete marítimo LCL', 195)],
      destinationCharges: [brl('Desconsolidação', 650), brl('THC destino', 500)],
      observations:
        'Op&#231;&#227;o econ&#244;mica com transbordo em Singapura. Conex&#227;o sujeita a janela do navio de segunda perna.',
      documents: [{ name: 'Proposta_Alpha_Opcao2.pdf', kind: 'pdf' }],
    },
    {
      ...base,
      id: 'a-gamma',
      agentId: 'gamma',
      agentName: 'Gamma Freight',
      route: 'direta',
      transshipment: null,
      frequency: null,
      freeTimeDays: null,
      transitDays: 36,
      departureInDays: null,
      carrier: 'Pacific Star Demo',
      validUntil: addDays(today, 12),
      originCharges: [eur('Taxas de origem', 70)],
      freightCharges: [eur('Frete marítimo LCL', 230)],
      destinationCharges: [brl('Desconsolidação', 600), brl('THC destino', 450)],
      observations:
        'SUJEITO A CONFIRMA&#199;&#195;O DE ESPA&#199;O. Free time e frequ&#234;ncia a confirmar com o armador ap&#243;s o booking.',
      documents: [
        { name: 'Cotacao_Gamma.pdf', kind: 'pdf' },
        { name: 'Tarifario_Gamma.xlsx', kind: 'xlsx' },
      ],
    },
    {
      ...base,
      id: 'a-delta',
      agentId: 'delta',
      agentName: 'Delta Shipping',
      route: 'direta',
      transshipment: null,
      frequency: 'semanal',
      freeTimeDays: 10,
      transitDays: 35,
      departureInDays: 4,
      carrier: 'Linha Atlântica Demo',
      validUntil: addDays(today, -3),
      originCharges: [usd('Taxas de origem', 70)],
      freightCharges: [usd('Frete marítimo LCL', 180)],
      destinationCharges: [brl('Taxas de destino', 1000)],
      observations: 'Tarifa promocional v&#225;lida para sa&#237;das deste m&#234;s.',
      documents: [{ name: 'Proposta_Delta.pdf', kind: 'pdf' }],
    },
    {
      ...base,
      id: 'a-beta',
      agentId: 'beta',
      agentName: 'Beta Cargo',
      route: 'direta',
      transshipment: null,
      frequency: 'semanal',
      freeTimeDays: 14,
      transitDays: 33,
      departureInDays: 3,
      carrier: 'Pacific Star Demo',
      validUntil: addDays(today, 20),
      insuranceIncluded: true,
      insurance: brl('Seguro internacional', 85),
      originCharges: [usd('Handling', 70), usd('Documentação', 25)],
      freightCharges: [usd('Frete marítimo LCL', 260)],
      destinationCharges: [brl('Desconsolidação', 700), brl('THC destino', 600)],
      observations:
        'Seguro inclu&#237;do sobre o valor da fatura comercial. Free time de 14 dias no terminal de destino.',
      documents: [{ name: 'Proposta_BetaCargo.pdf', kind: 'pdf' }],
    },
  ];
  return {
    request: {
      reference: DEMO_REFERENCE_A,
      orderNumber: 'PED-DEMO-2210',
      clientName: 'Aurora Componentes (demonstração)',
      contactFirstName: 'Marina',
      service: 'Frete internacional',
      modal: 'Marítimo',
      shipmentType: 'LCL',
      origin: 'Ningbo, China',
      destination: 'Itajaí, SC',
      incoterm: 'FOB',
      product: 'Conectores industriais',
      volumes: '6 caixas · 2,4 m³',
      weight: '480 kg',
      exporter: 'Eastbridge Components',
      countryOfOrigin: 'China',
      linkValidUntil: addDays(today, 12),
      insuranceRequired: false,
      ptax: PTAX,
      ptaxDate: addDays(today, -1),
      quotationDocuments: [
        { name: 'Invoice_proforma_demo.pdf', kind: 'pdf' },
        { name: 'Packing_list_demo.pdf', kind: 'pdf' },
      ],
    },
    proposals,
    chosenProposalId: null,
  };
}

/**
 * COT-DEMO-B: modelada num caso real (sem nenhum dado dele). Seguro exigido, uma
 * proposta sem seguro. A MAIOR NOTA é a da Delta — rápida, mas muito mais cara
 * (>10% acima da mais barata elegível) — e a RECOMENDADA é a Beta, a mais
 * barata elegível com rota direta. Neste estado o cliente já aprovou a Delta, e
 * o analista ainda não tinha aprovado recomendação nenhuma: a coluna mostra
 * "Escolhida" sem "Recomendada".
 */
function quotationB(today: string): ComparisonQuotation {
  const base = {
    shipmentType: 'FCL' as const,
    incoterm: 'FOB',
    portOfLoading: 'Shanghai, China',
    portOfDischarge: 'Santos, SP',
    highAuditPending: false,
    insuranceIncluded: true,
  };
  const proposals: ComparisonProposal[] = [
    {
      ...base,
      id: 'b-beta',
      agentId: 'beta',
      agentName: 'Beta Cargo',
      route: 'direta',
      transshipment: null,
      frequency: 'semanal',
      freeTimeDays: 12,
      transitDays: 44,
      departureInDays: 6,
      carrier: 'Oceano Sul Lines',
      validUntil: addDays(today, 14),
      insurance: usd('Seguro internacional', 120),
      originCharges: [usd('THC origem', 150), usd('Documentação', 30)],
      freightCharges: [usd('Frete marítimo 40HC', 3450)],
      destinationCharges: [brl('THC destino', 1900), brl('Liberação de BL', 1000)],
      observations:
        'Seguro calculado sobre o valor CIF informado. Valores sujeitos a confirma&#231;&#227;o no booking.',
      documents: [{ name: 'Proposta_BetaCargo_FCL.pdf', kind: 'pdf' }],
    },
    {
      ...base,
      id: 'b-gamma',
      agentId: 'gamma',
      agentName: 'Gamma Freight',
      route: 'direta',
      transshipment: null,
      frequency: 'semanal',
      freeTimeDays: 14,
      transitDays: 40,
      departureInDays: 5,
      carrier: 'Pacific Star Demo',
      validUntil: addDays(today, 12),
      insuranceIncluded: false,
      insurance: null,
      originCharges: [usd('THC origem', 140), usd('Documentação', 30)],
      freightCharges: [usd('Frete marítimo 40HC', 3200)],
      destinationCharges: [brl('THC destino', 1850), brl('Liberação de BL', 950)],
      observations:
        'SEGURO N&#195;O INCLU&#205;DO. Pode ser cotado &#224; parte mediante solicita&#231;&#227;o.',
      documents: [{ name: 'Cotacao_Gamma_FCL.pdf', kind: 'pdf' }],
    },
    {
      ...base,
      id: 'b-delta',
      agentId: 'delta',
      agentName: 'Delta Shipping',
      route: 'direta',
      transshipment: null,
      frequency: 'semanal',
      freeTimeDays: 21,
      transitDays: 24,
      departureInDays: 3,
      carrier: 'Linha Atlântica Demo',
      validUntil: addDays(today, 21),
      insurance: usd('Seguro internacional', 150),
      originCharges: [usd('THC origem', 170), usd('Documentação', 30)],
      freightCharges: [usd('Frete marítimo 40HC expresso', 4300)],
      destinationCharges: [brl('THC destino', 2000), brl('Liberação de BL', 1100)],
      observations:
        'Servi&#231;o expresso com prioridade de embarque e free time estendido de 21 dias.',
      documents: [
        { name: 'Proposta_Delta_Expresso.pdf', kind: 'pdf' },
        { name: 'Email_confirmacao_Delta.eml', kind: 'eml' },
      ],
    },
    {
      ...base,
      id: 'b-alpha',
      agentId: 'alpha',
      agentName: 'Alpha Logistics',
      route: 'transbordo',
      transshipment: 'Busan',
      frequency: 'quinzenal',
      freeTimeDays: 10,
      transitDays: 45,
      departureInDays: 8,
      carrier: 'Oceano Sul Lines',
      validUntil: addDays(today, 10),
      insurance: usd('Seguro internacional', 120),
      originCharges: [usd('THC origem', 150), usd('Documentação', 30)],
      freightCharges: [usd('Frete marítimo 40HC', 3550)],
      destinationCharges: [brl('THC destino', 1900), brl('Liberação de BL', 1000)],
      observations: 'Transbordo em Busan; conex&#227;o confirmada pelo armador.',
      documents: [{ name: 'Proposta_Alpha_FCL.pdf', kind: 'pdf' }],
    },
    {
      ...base,
      id: 'b-epsilon',
      agentId: 'epsilon',
      agentName: 'Epsilon Cargo',
      route: 'transbordo',
      transshipment: 'Singapura',
      frequency: 'semanal',
      freeTimeDays: 14,
      transitDays: 40,
      departureInDays: 4,
      carrier: 'Pacific Star Demo',
      validUntil: addDays(today, 7),
      insurance: usd('Seguro internacional', 130),
      originCharges: [usd('THC origem', 160), usd('Documentação', 30)],
      freightCharges: [usd('Frete marítimo 40HC', 3700)],
      destinationCharges: [brl('THC destino', 1950), brl('Liberação de BL', 1000)],
      observations: null,
      documents: [],
    },
  ];
  return {
    request: {
      reference: DEMO_REFERENCE_B,
      orderNumber: 'PED-DEMO-1984',
      clientName: 'Aurora Componentes (demonstração)',
      contactFirstName: 'Marina',
      service: 'Frete internacional',
      modal: 'Marítimo',
      shipmentType: 'FCL',
      origin: 'Shanghai, China',
      destination: 'Santos, SP',
      incoterm: 'FOB',
      product: 'Resina PP granulada',
      volumes: '1 contêiner 40 HC',
      weight: '24.800 kg',
      exporter: 'Yangtze Polymers',
      countryOfOrigin: 'China',
      linkValidUntil: addDays(today, 9),
      insuranceRequired: true,
      ptax: PTAX,
      ptaxDate: addDays(today, -1),
      quotationDocuments: [
        { name: 'Invoice_proforma_demo_B.pdf', kind: 'pdf' },
        { name: 'Ficha_tecnica_resina_demo.pdf', kind: 'pdf' },
      ],
    },
    proposals,
    chosenProposalId: 'b-delta',
  };
}

export function comparisonFixtures(today: string): ComparisonQuotation[] {
  return [quotationA(today), quotationB(today)];
}

export function findComparison(
  reference: string | null | undefined,
  today: string,
): ComparisonQuotation {
  const all = comparisonFixtures(today);
  return all.find((q) => q.request.reference === reference) ?? all[0];
}
