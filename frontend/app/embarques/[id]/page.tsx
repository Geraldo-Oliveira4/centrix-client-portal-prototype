'use client';

import { useParams } from 'next/navigation';
import { LoaderComponent, ErrorComponent } from '@arboria-tech/arboria-ui';
import { useShipment } from '@/hooks/use-shipments';
import { WorkspaceHeader } from './components/workspace-header';
import { WorkspaceTabs } from './components/workspace-tabs';

export default function EmbarqueWorkspacePage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';
  const { shipment, isLoading, isError, mutate } = useShipment(id);

  if (isLoading) return <LoaderComponent />;
  if (isError || !shipment) return <ErrorComponent />;

  return (
    <div className="space-y-6">
      <WorkspaceHeader shipment={shipment} />
      <WorkspaceTabs shipment={shipment} onShipmentChanged={() => mutate()} />
    </div>
  );
}
