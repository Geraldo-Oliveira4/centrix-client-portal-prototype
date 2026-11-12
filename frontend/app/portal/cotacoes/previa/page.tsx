import { requestDemoToday } from '@/lib/demo-clock';

import QuotationPreview from './quotation-preview';

export default function QuotationPreviewPage({
  searchParams,
}: {
  searchParams: { cenario?: string; variacoes?: string; hoje?: string };
}) {
  return (
    <QuotationPreview
      initialScenario={searchParams.cenario ?? 'comparar'}
      initialGuide={searchParams.variacoes === '1'}
      today={requestDemoToday(searchParams.hoje)}
    />
  );
}
