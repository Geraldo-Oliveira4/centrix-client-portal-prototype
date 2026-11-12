import { requestDemoToday } from '@/lib/demo-clock';

import ShipmentPreview from '../previa/shipment-preview';

// This public prototype shows explicit fictional scenarios, not live shipment data.
export default function ShipmentDetailPage({
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
