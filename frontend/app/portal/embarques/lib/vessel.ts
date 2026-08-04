// The vessel name is the one genuinely real tracking signal this repo has: the
// Freitas free-text note (`centrix_shipment_processos.observacao`) sometimes
// names the ship, and that note is a real DB column.
//
// It is all that survives of the old "Rastreamento marítimo" panel, which
// framed this real value inside a grid of fabricated ones (voyage, MBL,
// carrier, POL/POD, ETD/ETA derived from a hash of the reference). The panel
// was removed because its illustrative ETA contradicted the "Pendente
// integração" answer the same screen gives at the top: one screen, one answer
// per question. When the ShipsGo integration lands, the vessel comes from the
// feed (with everything else) — see types/portal-shipment.ts `tracking`.

/**
 * Parse a vessel name from the Freitas free-text note, e.g.
 * "Embarcado no navio MAERSK SELETAR, com origem..." -> "MAERSK SELETAR".
 * Uppercase-token match keeps it from over-capturing the lowercase prose that
 * follows. Returns null when the note is absent or names no ship — the caller
 * must then render nothing, never a placeholder.
 */
export function parseVesselFromObservacao(
  observacao?: string | null,
): string | null {
  if (!observacao) return null;
  const match = observacao.match(/navio\s+([A-Z0-9]+(?:\s+[A-Z0-9]+)*)/);
  return match ? match[1].trim() : null;
}
