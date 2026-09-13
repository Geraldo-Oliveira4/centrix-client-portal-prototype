'use client';

/** Approved alert experience; actions and context records remain demonstrative. */
export function ShipmentAlertsPreview() {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Prévia interativa · cenários fictícios, com fontes e dependências explicadas. Nenhum envio ou alteração em registros reais.
      </p>
      <iframe
        src="/prototypes/centrix-alertas/index.html?embed=1"
        title="Alertas — ações, filtros e registros relacionados"
        className="block w-full border-0"
        style={{ height: 'calc(100dvh - 285px)', minHeight: 700 }}
      />
    </div>
  );
}
