'use client';

import { useState } from 'react';
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui';
import type { Quotation, QuotationModal } from '@/types/quotation';

const KEEP_MODAL = '__keep__';

interface DuplicateModalProps {
  quotation: Quotation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDuplicate: (modal?: QuotationModal) => void;
}

export function DuplicateModal({ quotation, open, onOpenChange, onDuplicate }: DuplicateModalProps) {
  const [selectedModal, setSelectedModal] = useState<QuotationModal | typeof KEEP_MODAL>(KEEP_MODAL);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dialog-content-sm">
        <DialogHeader>
          <DialogTitle>Duplicar Cotacao</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            Deseja alterar o modal ao duplicar?
          </p>
          <Select value={selectedModal} onValueChange={(v) => setSelectedModal(v as QuotationModal | typeof KEEP_MODAL)}>
            <SelectTrigger>
              <SelectValue placeholder="Manter mesmo modal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={KEEP_MODAL}>Manter mesmo modal ({quotation.modal})</SelectItem>
              <SelectItem value="AEREO">Aereo</SelectItem>
              <SelectItem value="MARITIMO">Maritimo</SelectItem>
            </SelectContent>
          </Select>
          {selectedModal !== KEEP_MODAL && selectedModal !== quotation.modal && (
            selectedModal === 'AEREO' && (quotation.equipments?.length ?? 0) > 0 ? (
              <p className="text-xs text-amber-600">
                Ao trocar para aereo, os containers (equipamentos) serao limpos
                pois nao se aplicam ao modal aereo. Os volumes sao mantidos.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Os dados de carga (volumes) serao mantidos.
              </p>
            )
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => onDuplicate(selectedModal === KEEP_MODAL ? undefined : selectedModal as QuotationModal)}>
            Duplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
