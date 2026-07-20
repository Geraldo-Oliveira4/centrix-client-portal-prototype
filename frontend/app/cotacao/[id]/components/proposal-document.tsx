'use client';

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  PDFViewer,
} from '@react-pdf/renderer';
import type { Quotation, QuotationProposal } from '@/types/quotation';
import type { QuotationClient } from '@/types/client';
import { categorizeFee } from '@/utils/fee-categories';

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#1a1a1a',
    backgroundColor: '#ffffff',
  },
  header: {
    backgroundColor: '#1e3a5f',
    padding: 20,
    margin: -30,
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#94a3b8',
  },
  badge: {
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    padding: '3 8',
    borderRadius: 4,
    fontSize: 9,
    fontWeight: 'bold',
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1e3a5f',
    marginBottom: 10,
    paddingBottom: 6,
    borderBottom: '2px solid #e2e8f0',
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  infoItem: {
    width: '48%',
    marginBottom: 6,
  },
  infoLabel: {
    fontSize: 8,
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  recommendationBox: {
    backgroundColor: '#fefce8',
    border: '2px solid #eab308',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  recommendationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  recommendationBadge: {
    backgroundColor: '#eab308',
    color: '#ffffff',
    padding: '4 10',
    borderRadius: 4,
    fontSize: 10,
    fontWeight: 'bold',
  },
  proposalCard: {
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 6,
    padding: 12,
    marginBottom: 10,
  },
  proposalCardWinner: {
    backgroundColor: '#f0fdf4',
    border: '2px solid #22c55e',
    borderRadius: 6,
    padding: 12,
    marginBottom: 10,
  },
  proposalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 6,
    borderBottom: '1px solid #e2e8f0',
  },
  proposalAgent: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1e3a5f',
  },
  proposalValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#059669',
  },
  proposalDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  proposalDetail: {
    width: '30%',
  },
  proposalDetailLabel: {
    fontSize: 7,
    color: '#64748b',
    textTransform: 'uppercase',
  },
  proposalDetailValue: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#334155',
  },
  comparisonTable: {
    width: '100%',
    marginTop: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1e3a5f',
    padding: 8,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  tableHeaderCell: {
    fontWeight: 'bold',
    fontSize: 8,
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 6,
    borderBottom: '1px solid #e2e8f0',
  },
  tableRowEven: {
    backgroundColor: '#f8fafc',
  },
  tableRowWinner: {
    backgroundColor: '#f0fdf4',
  },
  tableCell: {
    fontSize: 9,
    color: '#334155',
  },
  winnerBadge: {
    backgroundColor: '#22c55e',
    color: '#ffffff',
    padding: '1 5',
    borderRadius: 3,
    fontSize: 7,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  observations: {
    backgroundColor: '#f1f5f9',
    borderLeft: '4px solid #3b82f6',
    padding: 12,
    marginTop: 12,
  },
  observationsTitle: {
    fontWeight: 'bold',
    color: '#1e3a5f',
    marginBottom: 6,
    fontSize: 11,
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 30,
    right: 30,
    textAlign: 'center',
    fontSize: 8,
    color: '#94a3b8',
    borderTop: '1px solid #e2e8f0',
    paddingTop: 10,
  },
  footerCompany: {
    fontWeight: 'bold',
    color: '#1e3a5f',
    marginBottom: 2,
  },
  noData: {
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 10,
    padding: 20,
  },
});

export interface ProposalDocumentConfig {
  includeComparison: boolean;
  highlightRecommendation: boolean;
  includeCostBreakdown: boolean;
  includeTimeline: boolean;
  observations: string;
}

export interface ProposalDocumentData {
  quotation: Quotation;
  proposals: QuotationProposal[];
  client: QuotationClient | undefined;
  config: ProposalDocumentConfig;
}

function formatCurrency(value: number | null | undefined, currency: string | null | undefined = 'USD'): string {
  if (value === null || value === undefined || isNaN(value)) return '-';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency ?? 'USD',
  }).format(value);
}

function buildGroupedCostLines(proposal: QuotationProposal): Array<{ label: string; value: string }> {
  const fc = proposal.freight_currency ?? 'USD';
  const origem: Record<string, number> = {};
  const frete: Record<string, number> = {};
  const destino: Record<string, number> = {};

  if (proposal.freight_value > 0) {
    frete[fc] = (frete[fc] ?? 0) + proposal.freight_value;
  }

  for (const [key, value] of Object.entries(proposal.taxes_breakdown ?? {})) {
    const currency = proposal.taxes_currency_breakdown?.[key] ?? fc;
    const cat = categorizeFee(key);
    if (cat === 'ORIGEM') {
      origem[currency] = (origem[currency] ?? 0) + value;
    } else if (cat === 'FRETE') {
      frete[currency] = (frete[currency] ?? 0) + value;
    } else {
      destino[currency] = (destino[currency] ?? 0) + value;
    }
  }

  function fmt(totals: Record<string, number>): string {
    const parts = Object.entries(totals)
      .filter(([, v]) => v > 0)
      .map(([curr, val]) => `${curr} ${Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    return parts.join(' + ') || '';
  }

  const lines: Array<{ label: string; value: string }> = [];
  const origemFmt = fmt(origem);
  const freteFmt = fmt(frete);
  const destinoFmt = fmt(destino);
  if (origemFmt) lines.push({ label: 'Taxas de Origem', value: origemFmt });
  if (freteFmt) lines.push({ label: 'Frete Internacional', value: freteFmt });
  if (destinoFmt) lines.push({ label: 'Taxas de Destino', value: destinoFmt });
  return lines;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    const d = dateStr.length === 10 ? new Date(`${dateStr}T12:00:00Z`) : new Date(dateStr);
    return d.toLocaleDateString('pt-BR');
  } catch {
    return '-';
  }
}

function getWinnerProposal(proposals: QuotationProposal[]): QuotationProposal | null {
  return proposals.find((p) => p.is_winner) || null;
}

export function ProposalDocument({
  quotation,
  proposals,
  client,
  config,
}: ProposalDocumentData) {
  const winner = getWinnerProposal(proposals);
  const hasProposals = proposals.length > 0;
  const today = formatDate(new Date().toISOString());

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>PROPOSTA COMERCIAL</Text>
          <Text style={styles.headerSubtitle}>
            Cotação {quotation.reference} • Emitida em {today}
          </Text>
          <Text style={styles.badge}>
            {quotation.modal || 'Modal não definido'}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DADOS DO CLIENTE</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Razão Social</Text>
              <Text style={styles.infoValue}>{client?.name || 'Não informado'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Código</Text>
              <Text style={styles.infoValue}>{client?.company_code || '-'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{client?.email || '-'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>DETALHES DA CARGA</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Modal</Text>
              <Text style={styles.infoValue}>{quotation.modal || '-'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Tipo de Embarque</Text>
              <Text style={styles.infoValue}>{quotation.tipo_embarque || '-'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Origem</Text>
              <Text style={styles.infoValue}>{quotation.origin || '-'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Destino</Text>
              <Text style={styles.infoValue}>
                {quotation.porto_destino?.join(', ') ||
                  quotation.aeroporto_destino?.join(', ') ||
                  '-'}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Produto</Text>
              <Text style={styles.infoValue}>{quotation.product || '-'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Incoterm</Text>
              <Text style={styles.infoValue}>{quotation.incoterm || '-'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Valor Declarado</Text>
              <Text style={styles.infoValue}>
                {formatCurrency(quotation.declared_value, quotation.declared_value_currency)}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Referência do Cliente</Text>
              <Text style={styles.infoValue}>{quotation.client_reference || '-'}</Text>
            </View>
          </View>
        </View>

        {config.highlightRecommendation && winner && (
          <View style={styles.recommendationBox}>
            <View style={styles.recommendationHeader}>
              <Text style={styles.recommendationBadge}>RECOMENDAÇÃO FREITAS CENTRIX</Text>
            </View>
            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Agente Recomendado</Text>
                <Text style={styles.infoValue}>{winner.agent?.name || 'Não informado'}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Valor Total</Text>
                <Text style={styles.infoValue}>{formatCurrency(winner.total_value, winner.freight_currency)}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Transit Time</Text>
                <Text style={styles.infoValue}>{winner.transit_time} dias</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Validade</Text>
                <Text style={styles.infoValue}>{formatDate(winner.validity)}</Text>
              </View>
            </View>
          </View>
        )}

        {hasProposals && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {config.includeComparison ? 'COMPARATIVO DE PROPOSTAS' : 'PROPOSTA SELECIONADA'}
            </Text>

            {config.includeComparison ? (
              <View style={styles.comparisonTable}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Agente</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.2, textAlign: 'right' }]}>Total</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>Frete</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 0.8, textAlign: 'center' }]}>Prazo</Text>
                  {config.includeCostBreakdown && (
                    <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'center' }]}>Taxas</Text>
                  )}
                </View>
                {proposals.map((proposal, index) => (
                  <View
                    key={proposal.id}
                    style={[
                      styles.tableRow,
                      proposal.is_winner ? styles.tableRowWinner : (index % 2 === 0 ? styles.tableRowEven : {}),
                    ]}
                  >
                    <Text style={[styles.tableCell, { flex: 2 }]}>
                      {proposal.agent?.name || 'Agente'}
                      {proposal.is_winner && <Text style={styles.winnerBadge}>WINNER</Text>}
                    </Text>
                    <Text style={[styles.tableCell, { flex: 1.2, textAlign: 'right', fontWeight: 'bold' }]}>
                      {formatCurrency(proposal.total_value, proposal.freight_currency)}
                    </Text>
                    <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>
                      {formatCurrency(proposal.freight_value, proposal.freight_currency)}
                    </Text>
                    <Text style={[styles.tableCell, { flex: 0.8, textAlign: 'center' }]}>
                      {proposal.transit_time}d
                    </Text>
                    {config.includeCostBreakdown && (
                      <Text style={[styles.tableCell, { flex: 1, textAlign: 'center' }]}>
                        {Object.keys(proposal.taxes_breakdown || {}).length > 0
                          ? `${Object.keys(proposal.taxes_breakdown).length} taxas`
                          : '-'}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            ) : winner ? (
              <View style={styles.proposalCardWinner}>
                <View style={styles.proposalHeader}>
                  <Text style={styles.proposalAgent}>
                    {winner.agent?.name || 'Agente não informado'}
                    <Text style={styles.winnerBadge}>RECOMENDADO</Text>
                  </Text>
                  <Text style={styles.proposalValue}>
                    {formatCurrency(winner.total_value, winner.freight_currency)}
                  </Text>
                </View>
                <View style={styles.proposalDetails}>
                  <View style={styles.proposalDetail}>
                    <Text style={styles.proposalDetailLabel}>Frete</Text>
                    <Text style={styles.proposalDetailValue}>
                      {formatCurrency(winner.freight_value, winner.freight_currency)}
                    </Text>
                  </View>
                  <View style={styles.proposalDetail}>
                    <Text style={styles.proposalDetailLabel}>Transit Time</Text>
                    <Text style={styles.proposalDetailValue}>
                      {winner.transit_time} dias
                    </Text>
                  </View>
                  <View style={styles.proposalDetail}>
                    <Text style={styles.proposalDetailLabel}>Validade</Text>
                    <Text style={styles.proposalDetailValue}>
                      {formatDate(winner.validity)}
                    </Text>
                  </View>
                  {config.includeCostBreakdown && winner.taxes_breakdown && (
                    <View style={[styles.proposalDetail, { width: '100%', marginTop: 6 }]}>
                      <Text style={styles.proposalDetailLabel}>Composicao de Custos</Text>
                      {buildGroupedCostLines(winner).map(({ label, value }) => (
                        <Text key={label} style={[styles.proposalDetailValue, { fontSize: 8, marginTop: 2 }]}>
                          {label}: {value}
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            ) : (
              <Text style={styles.noData}>Nenhuma proposta selecionada como recomendada.</Text>
            )}
          </View>
        )}

        {config.observations && (
          <View style={styles.observations}>
            <Text style={styles.observationsTitle}>OBSERVAÇÕES IMPORTANTES</Text>
            <Text>{config.observations}</Text>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerCompany}>Freitas Centrix</Text>
          <Text>Esta proposta é válida conforme prazo informado pelos agentes.</Text>
          <Text>Gerado em {today}</Text>
        </View>
      </Page>
    </Document>
  );
}

export function ProposalPDFViewer({ data }: { data: ProposalDocumentData }) {
  return (
    <PDFViewer style={{ width: '100%', height: '700px', border: 'none' }}>
      <ProposalDocument {...data} />
    </PDFViewer>
  );
}
