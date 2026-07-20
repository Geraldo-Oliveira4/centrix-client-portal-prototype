"""JSON Schema for proposal extraction fields + confidence scores.

Each field returns {value, confidence} so the frontend can display
extraction quality indicators alongside the pre-filled form.
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


PROPOSAL_EXTRACTION_SCHEMA = {
    "type": "object",
    "properties": {
        "total_value": _field(
            ["number", "null"],
            "Total proposal value, in the currency stated in the document (see freight_currency). "
            "Do NOT convert to another currency. Numeric only.",
        ),
        "freight_value": _field(
            ["number", "null"],
            "International freight / ocean freight portion, in the same currency as total_value. "
            "Do NOT convert. Numeric only.",
        ),
        "freight_currency": _field(
            ["string", "null"],
            "ISO 4217 currency code of total_value and freight_value, as stated in the document "
            "(e.g. 'USD', 'BRL', 'EUR', 'GBP', 'CNY', 'ARS', 'CLP', 'MXN', 'CHF'). "
            "null if the currency cannot be determined.",
        ),
        "transit_time": _field(
            ["integer", "null"],
            "Transit time in days. Extract numeric value only.",
        ),
        "carrier": _field(
            ["string", "null"],
            "Shipping line or airline name (e.g. 'MSC', 'Maersk', 'LATAM Cargo', 'Hapag-Lloyd').",
        ),
        "incoterm": _field(
            ["string", "null"],
            "Incoterm code (EXW, FCA, FOB, FAS, CFR, CIF, CPT, CIP, DAP, DPU, DDP). null if not mentioned.",
        ),
        "route_detail": _field(
            ["string", "null"],
            "Route description including ports, transshipment points (e.g. 'Shanghai → Singapore → Santos').",
        ),
        "route_type": {
            "type": "object",
            "properties": {
                "value": {
                    "type": ["string", "null"],
                    "enum": ["DIRETA", "TRANSBORDO", None],
                    "description": (
                        "Structured route type. Return TRANSBORDO only when the proposal explicitly "
                        "mentions transshipment, via, connection, T/S, or transbordo. Return DIRETA only "
                        "when it explicitly states direct route, direct service, sem transbordo, or no transshipment. "
                        "Return null if not clear."
                    ),
                },
                "confidence": {
                    "type": ["number", "null"],
                    "description": "Confidence score from 0.0 to 1.0. null if field not found.",
                },
            },
            "required": ["value", "confidence"],
            "additionalProperties": False,
        },
        "insurance_included": _field(
            ["boolean", "null"],
            "Whether insurance is included in the proposal. true/false/null if not mentioned.",
        ),
        "taxes_breakdown": {
            "type": "object",
            "properties": {
                "value": {
                    "type": ["object", "null"],
                    "description": (
                        "Cost breakdown as key-value pairs. Keys are tax/surcharge names "
                        "(e.g. 'THC', 'BAF', 'ISPS', 'BL Fee', 'Capatazia'), values are "
                        "amounts in their original currency (do NOT convert). "
                        "null if no breakdown found."
                    ),
                    "additionalProperties": {"type": "number"},
                },
                "confidence": {
                    "type": ["number", "null"],
                    "description": "Confidence score from 0.0 to 1.0. null if field not found.",
                },
            },
            "required": ["value", "confidence"],
            "additionalProperties": False,
        },
        "taxes_currency_breakdown": {
            "type": "object",
            "properties": {
                "value": {
                    "type": ["object", "null"],
                    "description": (
                        "Currency code for each tax/surcharge. Keys must match taxes_breakdown. "
                        "Values are ISO 4217 codes: 'USD', 'BRL', 'EUR', 'CNY', 'GBP', etc. "
                        "null if no breakdown found."
                    ),
                    "additionalProperties": {"type": "string"},
                },
                "confidence": {
                    "type": ["number", "null"],
                    "description": "Confidence score from 0.0 to 1.0. null if field not found.",
                },
            },
            "required": ["value", "confidence"],
            "additionalProperties": False,
        },
        "validity": _field(
            ["string", "null"],
            "Proposal validity date in ISO format (YYYY-MM-DD). Look for: 'validade', 'valid until', 'validity', 'vigencia'. null if not mentioned.",
        ),
        "numero_oferta": _field(
            ["string", "null"],
            "Agent's internal offer/quotation reference number. Look for: 'n° oferta', 'offer number', 'quote ref', 'cotacao n°', 'ref.'. null if not mentioned.",
        ),
        "frequencia": _field(
            ["string", "null"],
            "Shipping frequency or departure schedule. Look for: 'frequencia', 'frequency', 'sailing schedule', 'departures', 'weekly', 'semanal'. Return as descriptive text (e.g. 'Weekly', 'Every 15 days'). null if not mentioned.",
        ),
        "prazo_pagamento_dias": _field(
            ["integer", "null"],
            "Payment term in days. Look for: 'prazo de pagamento', 'payment terms', 'net days', 'vencimento'. Return integer only. null if not mentioned.",
        ),
        "free_time_dias": _field(
            ["integer", "null"],
            "Free time (demurrage/detention grace period) in days. Look for: 'free time', 'franquia', 'dias livres', a table row/column labeled 'FREE TIME'. Return integer only. null if not mentioned or shown only as a placeholder dash.",
        ),
        "observations": _field(
            ["string", "null"],
            (
                "Free-text observations, notes, and remarks found anywhere in the document — "
                "especially at the bottom of the first page or on the second page. "
                "Look for: 'observacoes', 'notas', 'remarks', 'notes', 'conditions', 'condicionantes', "
                "'termos e condicoes', 'validity conditions', 'special conditions', any free-text block "
                "that is not a structured field. Capture the full text verbatim. null if not found."
            ),
        ),
    },
    "required": [
        "total_value",
        "freight_value",
        "freight_currency",
        "transit_time",
        "carrier",
        "incoterm",
        "route_detail",
        "route_type",
        "insurance_included",
        "taxes_breakdown",
        "taxes_currency_breakdown",
        "validity",
        "numero_oferta",
        "frequencia",
        "prazo_pagamento_dias",
        "free_time_dias",
        "observations",
    ],
    "additionalProperties": False,
}

PROPOSAL_EXTRACTION_FIELDS = [
    "total_value",
    "freight_value",
    "freight_currency",
    "transit_time",
    "carrier",
    "incoterm",
    "route_detail",
    "route_type",
    "insurance_included",
    "taxes_breakdown",
    "taxes_currency_breakdown",
    "validity",
    "numero_oferta",
    "frequencia",
    "prazo_pagamento_dias",
    "free_time_dias",
    "observations",
]
