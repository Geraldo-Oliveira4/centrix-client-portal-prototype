import type { PortalQuotationsResponse } from '@/types/portal';
import { PagePortalHeader } from '../../_shared/page-header';
import { FunnelTab } from '../components/funnel-tab';
import examples from './examples.json';

/** Review-only examples: exporter names/date variations are not API enrichment. */
export default function QuotationCardsPreview() {
  return (
    <div className="space-y-6">
      <PagePortalHeader title="Minhas Cotações" />
      <div className="portal-small flex flex-wrap justify-between gap-2 text-portal-neutral">
        <p>
          Prévia dos cards · fornecedores e datas ilustrativos para revisão.
        </p>
        <a className="underline underline-offset-4" href="/portal/cotacoes">
          Ver com os dados atuais
        </a>
      </div>
      <FunnelTab data={examples as unknown as PortalQuotationsResponse} />
    </div>
  );
}
