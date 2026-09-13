import QuotationPreview from './quotation-preview';

export default function QuotationPreviewPage({
  searchParams,
}: {
  searchParams: { cenario?: string };
}) {
  return (
    <QuotationPreview initialScenario={searchParams.cenario ?? 'comparar'} />
  );
}
