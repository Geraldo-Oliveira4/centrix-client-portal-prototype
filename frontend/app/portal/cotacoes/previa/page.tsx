import QuotationPreview from './quotation-preview';

export default function QuotationPreviewPage({
  searchParams,
}: {
  searchParams: { cenario?: string; variacoes?: string };
}) {
  return (
    <QuotationPreview
      initialScenario={searchParams.cenario ?? 'comparar'}
      initialGuide={searchParams.variacoes === '1'}
    />
  );
}
