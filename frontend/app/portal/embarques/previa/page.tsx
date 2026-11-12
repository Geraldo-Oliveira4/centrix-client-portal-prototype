import { requestDemoToday } from '@/lib/demo-clock';

import ShipmentPreview from './shipment-preview';

export default function ShipmentPreviewPage({
  searchParams,
}: {
  searchParams: { cenario?: string; hoje?: string };
}) {
  return (
    <ShipmentPreview
      initialScenario={searchParams.cenario ?? 'transito'}
      today={requestDemoToday(searchParams.hoje)}
    />
  );
}
