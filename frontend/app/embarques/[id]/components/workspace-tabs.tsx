'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ShipmentDetail } from '@/types/shipment';
import { DadosGerais } from './sections/dados-gerais';
import { DadosFrete } from './sections/dados-frete-section';
import { Datas } from './sections/datas';
import { DocumentosSection } from './sections/documentos-section';
import { FollowupSection } from './sections/followup-section';

interface WorkspaceTabsProps {
  shipment: ShipmentDetail;
  onShipmentChanged: () => void;
}

export function WorkspaceTabs({ shipment, onShipmentChanged }: WorkspaceTabsProps) {
  return (
    <Tabs defaultValue="dados-gerais" className="w-full">
      <TabsList>
        <TabsTrigger value="dados-gerais">Dados Gerais</TabsTrigger>
        <TabsTrigger value="datas">Datas</TabsTrigger>
        <TabsTrigger value="documentos">Documentos</TabsTrigger>
        <TabsTrigger value="booking">Booking</TabsTrigger>
        <TabsTrigger value="followup">Follow-up</TabsTrigger>
      </TabsList>

      <div className="mt-6">
        <TabsContent value="dados-gerais">
          <DadosGerais shipment={shipment} />
        </TabsContent>
        <TabsContent value="datas">
          <Datas shipment={shipment} onSaved={onShipmentChanged} />
        </TabsContent>
        <TabsContent value="documentos">
          <DocumentosSection processId={shipment.id} />
        </TabsContent>
        <TabsContent value="booking">
          <DadosFrete key={shipment.id} processId={shipment.id} modal={shipment.modal} />
        </TabsContent>
        <TabsContent value="followup">
          <FollowupSection processId={shipment.id} />
        </TabsContent>
      </div>
    </Tabs>
  );
}
