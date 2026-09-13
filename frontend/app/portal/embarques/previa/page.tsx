import ShipmentPreview from './shipment-preview';

export default function ShipmentPreviewPage({
  searchParams,
}: {
  searchParams: { cenario?: string };
}) {
  return (
    <ShipmentPreview initialScenario={searchParams.cenario ?? 'transito'} />
  );
}
