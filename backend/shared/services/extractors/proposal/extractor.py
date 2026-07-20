"""Extracts structured fields from freight agent proposal documents.

Receives all document parts (email text + attachments) together so the
model can cross-reference pricing tables, route details, and terms
across multiple sources in a single call.
"""

import logging
from typing import Any

from shared.services import openrouter_service
from shared.services.extractors.base_extractor import BaseExtractor
from shared.services.extractors.proposal.schema import PROPOSAL_EXTRACTION_SCHEMA

logger = logging.getLogger(__name__)

_UNIT_VS_TOTAL_RULE = (
    'If the document shows both a unit/per-container rate and a total, always use\n'
    '   the total. If only a unit rate is available (e.g. "USD 1,200 per container"),\n'
    '   multiply by the quantity of containers/units stated in the same document to\n'
    '   get the total. Never return the unit rate as-is when a quantity greater\n'
    '   than 1 is present.'
)

_INSTRUCTIONS = """
FREIGHT PROPOSAL — FIELD EXTRACTION
====================================

You are analyzing a freight proposal (quotation response) sent by a freight
agent or shipping line. The documents may include an email, a PDF price
sheet, a spreadsheet with rates, or images of printed quotations.

ALL sources are provided together. Cross-reference information across the
email body AND all attachments to extract the most accurate value for each
field.

CONTEXT: This is a RESPONSE from a freight agent to a request for quotation
(RFQ). It contains pricing, transit times, routes, and commercial terms for
shipping cargo internationally.

THE FIELDS TO EXTRACT:

1. TOTAL_VALUE
   Total cost of the freight proposal, in the currency actually stated in the
   document — do NOT convert to USD or any other currency.
   Look for: "total", "valor total", "grand total", "total cost", bottom-line
   amount in pricing tables, sum of all line items.
   """ + _UNIT_VS_TOTAL_RULE + """
   Return numeric value only.

2. FREIGHT_VALUE
   International freight / ocean freight / air freight portion only, in the
   same currency as TOTAL_VALUE — do NOT convert.
   Look for: "ocean freight", "frete maritimo", "frete internacional",
   "air freight", "freight rate", the main line item excluding surcharges.
   """ + _UNIT_VS_TOTAL_RULE + """
   Return numeric value only.

2B. FREIGHT_CURRENCY
   ISO 4217 currency code of TOTAL_VALUE and FREIGHT_VALUE, exactly as stated
   or implied in the document (currency symbols, "USD", "US$", "R$", "BRL",
   "EUR", "€", "GBP", "£", "CNY", "RMB", "ARS", "CLP", "MXN", "CHF", etc.).
   Do not assume USD by default — read the actual symbol/code used in the
   pricing table or email. null only if genuinely undeterminable.

3. TRANSIT_TIME
   Door-to-door or port-to-port transit time in days.
   Look for: "transit time", "tempo de transito", "TT", "dias", "days",
   "ETA", delivery timeframe.
   If a range is given (e.g. "25-30 days"), use the upper bound.
   Return integer value only.

4. CARRIER
   Shipping line, airline, or transport company name.
   Look for: "armador", "carrier", "shipping line", "cia aerea",
   company logos, letterhead, vessel name context.
   Examples: MSC, Maersk, CMA CGM, Hapag-Lloyd, ONE, Evergreen, LATAM Cargo.

5. INCOTERM
   Incoterm code used in the proposal.
   One of: EXW, FCA, FOB, FAS, CFR, CIF, CPT, CIP, DAP, DPU, DDP
   Look for: near pricing, in headers, terms and conditions section.

6. ROUTE_DETAIL
   Shipping route with ports and transshipment points.
   Look for: "rota", "route", "via", "transshipment", port names,
   "POL", "POD", "T/S".
   Return a concise description (e.g. "Shanghai → Singapore → Santos").

7. ROUTE_TYPE
   Structured route type. Return exactly one of: DIRETA, TRANSBORDO, null.
   Return TRANSBORDO when the proposal explicitly mentions transshipment,
   transbordo, via, connection, conexao, T/S, or an intermediate port/airport.
   Return DIRETA when it explicitly states direct route, direct service,
   sem transbordo, no transshipment, or non-stop.
   Return null if the route type is not clear. Do not infer from transit time alone.

8. INSURANCE_INCLUDED
   Whether insurance coverage is included in the quoted price.
   Look for: "seguro incluso", "insurance included", "c/ seguro",
   "s/ seguro", "insurance not included", CIF vs CFR.
   Return true/false.

9. TAXES_BREAKDOWN + TAXES_CURRENCY_BREAKDOWN (two paired fields)
   Itemized cost components beyond the base freight.
   Look for line items in pricing tables:
   - THC (Terminal Handling Charge)
   - BAF (Bunker Adjustment Factor)
   - ISPS (Security surcharge)
   - BL Fee (Bill of Lading fee)
   - Capatazia, Desconsolidacao
   - Customs clearance, documentation fees
   - Any other named surcharges or fees
   TAXES_BREAKDOWN: return as object {"surcharge_name": amount, ...} using the
   original currency shown in the document — do NOT convert to USD.
   TAXES_CURRENCY_BREAKDOWN: return as object {"surcharge_name": "USD"|"BRL"|"EUR"|..., ...}
   using the same keys as TAXES_BREAKDOWN.
   Only include items explicitly listed with values.
   CRITICAL: never include the ocean/air freight line itself (or any line that
   repeats the same amount already captured in FREIGHT_VALUE) as a surcharge
   here — it is already tracked separately in FREIGHT_VALUE. Including it here
   double-counts the freight cost in every downstream total. Also do not
   include TOTAL_VALUE as one of its own components.

10. VALIDITY
   Date until which the proposal pricing is valid.
   Look for: "validade", "valid until", "validity", "vigencia", "expiry date",
   "cotacao valida ate".
   Return as ISO date string (YYYY-MM-DD). null if not found.

11. NUMERO_OFERTA
    Agent's internal offer or quotation reference number.
    Look for: "n° oferta", "offer number", "quote ref", "cotacao n°",
    "ref.", reference codes in headers, footers, or subject lines.
    Return as string. null if not found.

12. FREQUENCIA
    Shipping frequency or departure schedule.
    Look for: "frequencia", "frequency", "sailing schedule", "departures",
    "weekly", "semanal", departure days of the week.
    Return as descriptive text (e.g. "Weekly", "Every 15 days", "Semanal").
    null if not found.

13. PRAZO_PAGAMENTO_DIAS
    Payment term in days.
    Look for: "prazo de pagamento", "payment terms", "net days",
    "vencimento", "30 dias", "net 30".
    Return integer only. null if not found.

14. FREE_TIME_DIAS
    Free time (demurrage/detention grace period) in days, granted at destination
    before storage/demurrage charges apply.
    Look for: "free time", "franquia", "dias livres", a table row/column
    labeled "FREE TIME" (often per transshipment/route column in comparative
    rate sheets), "20 dias", "21 dias".
    If a range is given (e.g. "14-21 dias"), use the upper bound.
    Return integer value only. null if not found (including when the cell only
    contains a placeholder dash "—" or is blank).

15. OBSERVATIONS
    Free-text remarks, notes, or conditions found anywhere in the document —
    especially at the bottom of the first page or on subsequent pages.
    Look for: "observacoes", "notas", "remarks", "notes", "conditions",
    "condicionantes", "termos e condicoes", "validity conditions",
    "special conditions", any free-text block not covered by the fields above.
    Capture the full text verbatim, preserving line breaks as newlines.
    null if no observations are found.

CONFIDENCE SCORING (per field):
- 0.9-1.0: Explicitly stated with exact value
- 0.7-0.8: Clearly implied or minor interpretation needed
- 0.5-0.6: Ambiguous, requires interpretation
- 0.3-0.4: Weak signal, inferred from indirect data
- null: Field not found in ANY source

RULES:
- If a field appears in multiple sources, use the most specific/detailed value
- If sources conflict, prefer the attachment (pricing sheet) over the email body
- If a field is not found anywhere, set value to null and confidence to null
- Do NOT invent or guess values — only extract what is explicitly present
- Documents may be in Portuguese, English, Spanish, or Chinese
- Currency: keep ALL amounts in their original currency — never convert. Populate
  freight_currency with the currency of total_value/freight_value, and
  taxes_currency_breakdown with the currency code per tax item.
"""


class ProposalExtractor(BaseExtractor):

    def __init__(self):
        super().__init__("proposal_full")

    def extract(self, document_parts: list[dict], fast_fail: bool = False) -> dict[str, Any]:
        """Extract proposal fields from all sources combined.

        Args:
            document_parts: List of content parts (text and image parts)
                from email body + all attachments, already processed
                via prepare_document().
            fast_fail: when True, use the synchronous fail-fast profile
                (single attempt, no model fallback, tight HTTP timeout) so the
                call stays within the agent-facing Lambda budget. Defaults to
                False for the async (SQS) path, which has no tight deadline.

        Returns:
            {"result": {fields with value+confidence}, "model": "..."} on success.
            {"result": None, "error": "..."} on failure.
        """
        extra = (
            {
                "max_attempts": openrouter_service.SYNC_MAX_ATTEMPTS,
                "use_fallback": False,
                "timeout": openrouter_service.SYNC_HTTP_TIMEOUT_SECONDS,
            }
            if fast_fail
            else {}
        )
        return self.call_extraction(
            document_parts=document_parts,
            instructions=_INSTRUCTIONS,
            json_schema=PROPOSAL_EXTRACTION_SCHEMA,
            schema_name="proposal_extraction",
            **extra,
        )
