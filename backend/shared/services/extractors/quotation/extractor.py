"""Extracts quotation fields from an email body + all attachments in a single LLM call.

Receives all document parts (email text + rendered attachments) together so the
model can cross-reference information across sources and pick the best value
for each field regardless of where it appears.
"""

import logging
from typing import Any

from shared.services.extractors.base_extractor import BaseExtractor
from shared.services.extractors.quotation.schema import QUOTATION_EXTRACTION_SCHEMA

logger = logging.getLogger(__name__)

_INSTRUCTIONS = """
FREIGHT QUOTATION REQUEST — FULL EXTRACTION
============================================

You are analyzing a freight quotation request that includes an email body and
possibly one or more attached documents (invoices, packing lists, proformas,
images, spreadsheets, or other commercial documents).

ALL sources are provided together. Cross-reference information across the email
body AND all attachments to extract the most accurate value for each field.

FIELDS TO EXTRACT:

1. SERVICE_TYPE
   Direction of the shipment. Must be exactly one of:
   - IMPORTACAO — cargo arriving in Brazil
   - EXPORTACAO — cargo leaving Brazil
   null if unclear.

2. ORIGIN (local de coleta)
   Where the cargo will be collected from the shipper.
   - Email: "de", "from", "origem", "saindo de", "embarque em", "local de coleta"
   - Attachments: shipper address, port of loading, "POL", country of origin
   Return city/port + country (e.g. "Shanghai, China")

3. MODAL
   Transport mode. Must be exactly one of:
   - AEREO — "aereo", "air", "aviao", air waybill (AWB)
   - MARITIMO — sea freight of any kind (container, LCL, bulk, reefer)
   null if unclear.

5. TIPO_EMBARQUE
   Maritime sub-type. Only set when modal is MARITIMO. Must be exactly one of:
   - FCL — full container load: "container", "FCL", "full container", "40HC", "20'", reefer container
   - LCL — consolidated/groupage: "LCL", "carga consolidada", "grupagem", "consolidado"
   - BREAK_BULK — project/loose cargo: "break bulk", "carga solta", "projeto", "RO-RO"
   null if modal is AEREO or unclear.

6. INCOTERM
   One of: EXW, FCA, FOB, FAS, CFR, CIF, CPT, CIP, DAP, DPU, DDP
   Common locations: email text, invoice header, near total value, payment terms.

7. PRODUCT
   What is being shipped.
   Look for: product/cargo/goods description, item tables, commodity
   Return a concise description (e.g. "auto parts", "frozen chicken")

8. DESIRED_DEADLINE
   When the client needs the cargo delivered.
   Look for: "prazo", "deadline", "ate dia", "ETD", "ETA", "preciso ate"
   Return in ISO format: YYYY-MM-DD

9. DECLARED_VALUE
   Total cargo monetary value, in the currency actually stated in the
   document (see DECLARED_VALUE_CURRENCY) — do NOT convert to USD.
   Look for: "valor", "value", "invoice total", "FOB value"
   Return numeric value only.

10. STACKABILITY
    Whether cargo can be stacked on top of each other.
    Look for: "empilhavel", "stackable", "nao empilhar", "do not stack",
    stacking symbols, handling instructions
    Return true/false.

11. CARGA_PERIGOSA
    Dangerous goods classification. Must be exactly one of:
    - NAO — not dangerous
    - RA — radioactive material
    - IMO — IMDG/hazmat (any UN number, MSDS, DG declaration)
    null if not mentioned.

12. UN_NUMBER
    UN dangerous goods number. Only extract when carga_perigosa is IMO or RA.
    Look for: "UN", "UN number", "numero ONU", "UN1263", MSDS sheets, DG declarations.
    Return as string including the "UN" prefix (e.g. "UN1263"). null otherwise.

13. IMO_CLASS
    IMO hazard class code. Only extract when carga_perigosa is IMO.
    Look for: "class", "classe IMO", "IMDG class", "hazard class", DG labels.
    Examples: "3" (flammable liquid), "6.1" (toxic), "8" (corrosive).
    Return as string (e.g. "3", "6.1"). null otherwise.

14. DATA_PRONTIDAO
    When the cargo will be ready for pickup or loading.
    Look for: "prontidao", "cargo ready", "ready date", "disponivel em",
    "ETD" (estimated time of departure from origin).
    Return in ISO format: YYYY-MM-DD. null if not mentioned.

15. CARGA_TOMBAVEL
    Whether the cargo can be tilted or is top-heavy.
    Look for: "tombavel", "tipping", "top heavy", "nao tombar",
    "do not tilt", handling symbols for "this side up".
    Return true/false. null if not mentioned.

16. TEMPERATURA_MIN / TEMPERATURA_MAX
    Temperature range in Celsius required for reefer/cold chain cargo.
    Look for: "temperatura", "temp range", "-18°C", "+2/+8°C", reefer specs.
    Return numeric values only. null if not applicable.

17. CLIENT_REFERENCE
    The client's own reference for this shipment (PO number, internal code).
    Look for: "PO", "purchase order", "ref", "referencia", "nosso numero"
    null if not mentioned.

18. EXPORTADOR
    Exporter or shipper company name.
    Look for: shipper name in invoice/packing list header, "shipper", "exportador",
    "remetente", "from" (in company context, not email from).
    Return the company name only (e.g. "Shenzhen Electronics Co. Ltd").
    null if not found in any document.

19. PAIS_PROCEDENCIA
    Country of origin for customs declaration.
    Look for: "country of origin", "pais de origem", "pais de procedencia",
    "made in", "fabricado em", "origem", the shipper's country.
    Return country name (e.g. "China", "Alemanha", "Estados Unidos").
    null if not mentioned.

20. BL_CONSOLIDADO
    Whether a consolidated Bill of Lading is requested (LCL only).
    Look for: "BL consolidado", "HBL", "house bill", "master BL"
    true/false/null.

21. PORTO_EMBARQUE
    Port of loading for maritime shipments (modal = MARITIMO).
    Look for: "POL", "port of loading", "porto de embarque", "porto de origem",
    "saindo de" (port context), "via", departure port in routing instructions.
    Return port name (e.g. "Shanghai", "Santos", "Rotterdam"). null if modal is AEREO or not mentioned.

22. PORTO_DESTINO
    Port of discharge for maritime shipments (modal = MARITIMO).
    Look for: "POD", "port of discharge", "porto de destino", "porto de descarga",
    "chegando em" (port context), destination port in routing instructions.
    Return port name (e.g. "Santos", "Rotterdam", "Hamburg"). null if modal is AEREO or not mentioned.

23. AEROPORTO_EMBARQUE
    Departure airport for air shipments (modal = AEREO).
    Look for: "airport of departure", "aeroporto de origem", "AWB origin", "from airport",
    IATA codes near origin city (e.g. PVG, SHA, FRA, JFK).
    Return IATA code if available, otherwise city/airport name. null if modal is MARITIMO or not mentioned.

24. AEROPORTO_DESTINO
    Destination airport for air shipments (modal = AEREO).
    Look for: "airport of destination", "aeroporto de destino", "AWB destination", "to airport",
    IATA codes near destination city (e.g. GRU, VCP, GIG).
    Return IATA code if available, otherwise city/airport name. null if modal is MARITIMO or not mentioned.

25. DECLARED_VALUE_CURRENCY
    ISO 4217 currency code of the declared cargo value, as stated or implied
    in the document.
    Look for currency symbols or codes near the declared value: "$" / "USD",
    "€" / "EUR", "R$" / "BRL", "£" / "GBP", "¥" / "CNY" (or "RMB"), "$" / "ARS"
    (Argentina), "$" / "CLP" (Chile), "$" / "MXN" (Mexico), "CHF" (Switzerland).
    Use surrounding context (country of origin/destination, other currency
    mentions in the document) to disambiguate symbols shared by multiple
    currencies (e.g. a bare "$" near a Chilean or Argentine address is not USD).
    Do not assume USD by default — only fall back to USD when declared_value
    is present but no currency signal exists anywhere in the document.
    null if declared_value is null.

26. VOLUMES (lista de volumes/cargas)
    Extract individual cargo volumes/packages from packing lists, invoices, or cargo details tables.
    Look for tables with columns like: quantity, weight, dimensions, packaging.
    For each volume/package found, extract:
    - quantity: Number of packages on this line. Use 1 if not specified.
    - peso_bruto: TOTAL gross weight in kilograms for all units of this line (not per-unit weight).
      If the document shows both unit weight and total weight, always use the total.
      If only unit weight is available, multiply by quantity to get the total.
      (look for "peso total", "total weight", "peso bruto total", "kg"; prefer total columns over unit columns)
      CRITICAL — Brazilian number format: period (.) is thousands separator, comma (,) is decimal.
      '25.000 kg' = 25 kg. '1.500,00 kg' = 1,500 kg. '25,5 kg' = 25.5 kg.
      Always verify the weight makes physical sense for the cargo size before returning it.
    - comprimento: Length — exact numeric value as written in the document (do NOT convert units).
    - largura: Width — exact numeric value as written in the document (do NOT convert units).
    - altura: Height — exact numeric value as written in the document (do NOT convert units).
    - dimensao_unidade: Unit of the dimensions. Exactly one of: MM, CM, M, POL.
      Look for unit labels next to dimensions: "mm", "cm", "m", "in", "pol".
      If not stated, use CM as default.
    - volume_m3: Volume in cubic meters ONLY if explicitly stated in the document. Do NOT calculate it.
    - embalagem: Packaging type (e.g., "caixa", "pallet", "sacaria", "caixas", "pallets")
    Return as array of objects. Empty array if no volume data found.
    Look in: packing lists, cargo tables, invoice line items with dimensions.
    Used for: LCL shipments, air cargo, break bulk cargo.

27. EQUIPMENTS (lista de containers/equipamentos) — FCL ONLY
    Extract FCL container specifications when tipo_embarque is FCL.
    Look for container counts and types in: shipping instructions, booking requests, SO (Shipping Order).
    For each container type found, extract:
    - quantity: Number of containers (e.g., 2 for "2x 40HC")
    - tipo_container: Container type code. Must be one of:
      * STANDARD_20 — "20'", "20ft", "20 std", "standard 20"
      * STANDARD_40 — "40'", "40ft", "40 std", "standard 40"
      * HIGH_CUBE_40 — "40HC", "40' HC", "high cube", "40 high"
      * REFRIGERATED_20 — "20' reefer", "reefer 20", "refrigerated 20"
      * REFRIGERATED_40 — "40' reefer", "reefer 40", "refrigerated 40"
      * NOR_40 — "40' NOR", "NOR 40" (non-operational reefer)
      * OPEN_TOP_20 — "20' OT", "open top 20"
      * OPEN_TOP_40 — "40' OT", "open top 40"
      * FLATRACK_20 — "20' FR", "flat rack 20"
      * FLATRACK_40 — "40' FR", "flat rack 40"
    - peso_bruto: Total cargo weight in container (kg) — sum of all cargo weights
    - volume_m3: Total cargo volume in cubic meters
    Return as array of objects. Empty array if FCL not mentioned or tipo_embarque is not FCL.
    Used for: FCL (full container load) maritime shipments only.

CONFIDENCE SCORING (per field):
- 0.9-1.0: Explicitly stated with exact value
- 0.7-0.8: Clearly implied or minor interpretation needed
- 0.5-0.6: Ambiguous, requires interpretation
- 0.3-0.4: Weak signal, possibly inferred from indirect data
- null: Field not found in ANY source

RULES:
- If a field appears in multiple sources, use the most specific/detailed value
- If sources conflict, prefer the attachment (more formal) over the email body
- If a field is not found anywhere, set value to null and confidence to null
- Do NOT invent or guess values
- Documents may be in Portuguese, English, Spanish, or Chinese
- BRAZILIAN NUMBER FORMAT: Brazilian and European commercial documents use period (.) as
  the thousands separator and comma (,) as the decimal separator. Examples:
  '25.000 kg' = 25 kg (not 25,000 kg). '1.500,00 USD' = 1,500 USD. '63,333 m³' = 63.333 m³.
  Always verify numeric values are physically reasonable for the cargo described.
"""


class QuotationExtractor(BaseExtractor):

    def __init__(self):
        super().__init__("quotation_full")

    def extract(self, document_parts: list[dict]) -> dict[str, Any]:
        """Extract quotation fields from all sources combined.

        Unlike other extractors, this receives pre-built document parts
        (email body + all attachments already prepared) rather than raw bytes.

        Args:
            document_parts: List of content parts (text and image parts)
                from email body + all attachments, already processed
                via prepare_document().

        Returns:
            {"result": {fields with value+confidence}, "model": "..."} on success.
            {"result": None, "error": "..."} on failure.
        """
        return self.call_extraction(
            document_parts=document_parts,
            instructions=_INSTRUCTIONS,
            json_schema=QUOTATION_EXTRACTION_SCHEMA,
            schema_name="quotation_extraction",
        )
