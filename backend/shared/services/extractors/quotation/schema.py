"""JSON Schema for quotation extraction fields + confidence scores.

Shared by all quotation extractors (email body, attachments).
Each extractor returns this same shape so results can be merged.
"""


def _field(value_type: list, description: str) -> dict:
    return {
        "type": "object",
        "properties": {
            "value": {
                "type": value_type,
                "description": description,
            },
            "confidence": {
                "type": ["number", "null"],
                "description": "Confidence score from 0.0 to 1.0. null if field not found.",
            },
        },
        "required": ["value", "confidence"],
        "additionalProperties": False,
    }


QUOTATION_EXTRACTION_SCHEMA = {
    "type": "object",
    "properties": {
        # --- Core completeness fields (9) ---
        "service_type": _field(
            ["string", "null"],
            "Direction of the shipment. One of: IMPORTACAO (inbound to Brazil), EXPORTACAO (outbound from Brazil). null if unclear.",
        ),
        "origin": _field(
            ["string", "null"],
            "Collection location / local de coleta (e.g. 'Shanghai, China', 'Hamburg'). Where the cargo will be picked up from the shipper.",
        ),
        "modal": _field(
            ["string", "null"],
            "Transport modal. One of: AEREO, MARITIMO. null if unclear.",
        ),
        "tipo_embarque": _field(
            ["string", "null"],
            "Maritime shipment sub-type. One of: FCL (full container), LCL (consolidated), BREAK_BULK. Only set when modal is MARITIMO. null otherwise.",
        ),
        "incoterm": _field(
            ["string", "null"],
            "Incoterm code (EXW, FCA, FOB, FAS, CFR, CIF, CPT, CIP, DAP, DPU, DDP). null if not mentioned.",
        ),
        "product": _field(
            ["string", "null"],
            "Product description or cargo type (e.g. 'auto parts', 'frozen chicken', 'chemical products').",
        ),
        "desired_deadline": _field(
            ["string", "null"],
            "Desired delivery/arrival date in ISO format (YYYY-MM-DD). null if not mentioned.",
        ),
        "declared_value": _field(
            ["number", "null"],
            "Declared cargo value, in the currency actually stated in the document "
            "(see declared_value_currency). Do NOT convert to USD. Extract numeric value only.",
        ),
        "stackability": _field(
            ["boolean", "null"],
            "Whether cargo can be stacked. true/false/null if not mentioned.",
        ),
        # --- Additional fields (not in completeness score) ---
        "carga_perigosa": _field(
            ["string", "null"],
            "Dangerous goods classification. One of: NAO (not dangerous), RA (radioactive), IMO (IMDG/hazmat). null if not mentioned.",
        ),
        "un_number": _field(
            ["string", "null"],
            "UN dangerous goods number (e.g. 'UN1263'). Extract only when carga_perigosa is IMO or RA. null otherwise.",
        ),
        "imo_class": _field(
            ["string", "null"],
            "IMO hazard class code (e.g. '3', '6.1', '8'). Extract only when carga_perigosa is IMO. null otherwise.",
        ),
        "data_prontidao": _field(
            ["string", "null"],
            "Cargo readiness date in ISO format (YYYY-MM-DD) — when the goods will be available for pickup/loading. null if not mentioned.",
        ),
        "carga_tombavel": _field(
            ["boolean", "null"],
            "Whether the cargo can be tilted or tipped during transport. true/false/null if not mentioned.",
        ),
        "temperatura_min": _field(
            ["number", "null"],
            "Minimum required temperature in Celsius for refrigerated/reefer cargo. null if not applicable.",
        ),
        "temperatura_max": _field(
            ["number", "null"],
            "Maximum required temperature in Celsius for refrigerated/reefer cargo. null if not applicable.",
        ),
        "client_reference": _field(
            ["string", "null"],
            "Client's own reference number for this shipment (e.g. PO number, internal code). null if not mentioned.",
        ),
        "exportador": _field(
            ["string", "null"],
            "Exporter or shipper company name. Look for: shipper name in invoice/packing list, 'shipper', 'exportador', 'remetente', 'from' (company context). Return company name only. null if not found.",
        ),
        "pais_procedencia": _field(
            ["string", "null"],
            "Country of origin of the goods for customs purposes. Look for: 'country of origin', 'pais de origem', 'pais de procedencia', 'made in', 'fabricado em', or the shipper's country. Return country name in Portuguese or English (e.g. 'China', 'Alemanha', 'Estados Unidos'). null if not mentioned.",
        ),
        "porto_embarque": _field(
            ["string", "null"],
            "Port of loading for maritime shipments (e.g. 'Shanghai', 'Santos'). Only set when modal is MARITIMO. null otherwise.",
        ),
        "porto_destino": _field(
            ["string", "null"],
            "Port of discharge/destination for maritime shipments (e.g. 'Santos', 'Rotterdam'). Only set when modal is MARITIMO. null otherwise.",
        ),
        "aeroporto_embarque": _field(
            ["string", "null"],
            "Departure airport for air shipments (e.g. 'PVG', 'GRU'). IATA code or full name. Only set when modal is AEREO. null otherwise.",
        ),
        "aeroporto_destino": _field(
            ["string", "null"],
            "Destination airport for air shipments (e.g. 'GRU', 'JFK'). IATA code or full name. Only set when modal is AEREO. null otherwise.",
        ),
        "declared_value_currency": _field(
            ["string", "null"],
            "ISO 4217 currency code of the declared cargo value, as stated or implied in the "
            "document (e.g. 'USD', 'BRL', 'EUR', 'GBP', 'CNY', 'ARS', 'CLP', 'MXN', 'CHF'). "
            "Do not assume USD by default — read the actual symbol/code used. "
            "Only default to USD when declared_value is present but no currency is stated at all. "
            "null if declared_value is null.",
        ),
        "volumes": {
            "type": "object",
            "properties": {
                "value": {
                    "type": "array",
                    "description": "List of cargo volumes/packages extracted from packing lists. Each volume has weight, dimensions, and packaging type.",
                    "items": {
                        "type": "object",
                        "properties": {
                            "quantity": {"type": ["integer", "null"], "description": "Number of packages/units on this line. Use 1 if not specified."},
                            "peso_bruto": {"type": ["number", "null"], "description": "TOTAL gross weight for this line in kilograms. IMPORTANT: Brazilian documents use period as thousands separator — '25.000 kg' means 25 kg, not 25,000 kg. '1.500,00 kg' means 1,500 kg. Always interpret weight in context of the cargo size."},
                            "comprimento": {"type": ["number", "null"], "description": "Length — extract the numeric value exactly as written in the document. Do NOT convert units."},
                            "largura": {"type": ["number", "null"], "description": "Width — extract the numeric value exactly as written in the document. Do NOT convert units."},
                            "altura": {"type": ["number", "null"], "description": "Height — extract the numeric value exactly as written in the document. Do NOT convert units."},
                            "dimensao_unidade": {"type": ["string", "null"], "description": "Unit of the dimensions. Must be exactly one of: MM, CM, M, POL. Infer from the document (e.g. 'mm' → MM, 'cm' → CM, 'm' → M, 'in' or 'pol' → POL). null if unit not stated anywhere in the document."},
                            "volume_m3": {"type": ["number", "null"], "description": "Volume in cubic meters if explicitly stated in the document. Do NOT calculate — only return if the document provides it. null otherwise."},
                            "embalagem": {"type": ["string", "null"], "description": "Packaging type (e.g., 'caixa', 'pallet', 'sacaria')"},
                        },
                        "required": ["quantity", "peso_bruto", "comprimento", "largura", "altura", "dimensao_unidade", "volume_m3", "embalagem"],
                    },
                },
                "confidence": {"type": ["number", "null"], "description": "Confidence score from 0.0 to 1.0 for volume extraction. null if no volumes found."},
            },
            "required": ["value", "confidence"],
        },
        "equipments": {
            "type": "object",
            "properties": {
                "value": {
                    "type": "array",
                    "description": "List of FCL containers/equipment extracted from documents. Used when tipo_embarque is FCL (full container load).",
                    "items": {
                        "type": "object",
                        "properties": {
                            "quantity": {"type": ["integer", "null"], "description": "Number of containers of this type"},
                            "tipo_container": {"type": ["string", "null"], "description": "Container type: STANDARD_20, STANDARD_40, HIGH_CUBE_40, REFRIGERATED_20, REFRIGERATED_40, NOR_40, OPEN_TOP_20, OPEN_TOP_40, FLATRACK_20, FLATRACK_40, etc."},
                            "peso_bruto": {"type": ["number", "null"], "description": "Total gross weight of cargo in this container (kg)"},
                            "volume_m3": {"type": ["number", "null"], "description": "Total cargo volume in cubic meters"},
                        },
                        "required": ["quantity", "tipo_container"],
                    },
                },
                "confidence": {"type": ["number", "null"], "description": "Confidence score from 0.0 to 1.0 for equipment extraction. null if no equipment found."},
            },
            "required": ["value", "confidence"],
        },
    },
    "required": [
        "service_type", "origin", "modal", "tipo_embarque",
        "incoterm", "product", "desired_deadline", "declared_value", "stackability",
        "carga_perigosa", "un_number", "imo_class",
        "data_prontidao", "carga_tombavel",
        "temperatura_min", "temperatura_max",
        "client_reference",
        "exportador", "pais_procedencia",
        "porto_embarque", "porto_destino",
        "aeroporto_embarque", "aeroporto_destino",
        "declared_value_currency",
    ],
    "additionalProperties": False,
}

# All fields the LLM extracts. Used in parse_extraction_result to map the
# structured output into extracted_fields / confidence_scores dicts.
# The completeness score (13 fields) is calculated separately in the repository
# from _COMPLETENESS_FIELDS — this list does not affect that calculation.
EXTRACTION_FIELDS = [
    "service_type", "origin", "modal", "tipo_embarque",
    "incoterm", "product", "desired_deadline", "declared_value", "stackability",
    "carga_perigosa", "un_number", "imo_class",
    "data_prontidao", "carga_tombavel",
    "temperatura_min", "temperatura_max",
    "client_reference",
    "exportador", "pais_procedencia",
    "porto_embarque", "porto_destino",
    "aeroporto_embarque", "aeroporto_destino",
    "declared_value_currency",
    "volumes",
    "equipments",
]
