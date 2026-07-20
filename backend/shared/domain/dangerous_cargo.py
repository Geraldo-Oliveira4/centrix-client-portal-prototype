"""Shared dangerous-cargo signal resolution (ARB-2443).

Dangerous cargo can be flagged at two levels that are additive, not
mutually exclusive: the client DNA (client-level, coarse) and the linked
Exporter (per-shipment, precise). Used by both quotation_audit_engine
(rule 1.7) and rfq_validation (soft warning) so the two flags are derived
identically in both places.
"""

from shared.database.models.quotation.enums import ExporterCargoProfile


def resolve_dangerous_cargo_flags(dna, exporter) -> tuple[bool, bool]:
    """Returns (dna_flags_dangerous, exporter_flags_dangerous)."""
    dna_flags_dangerous = bool(dna and dna.dangerous_cargo_shipper)
    exporter_flags_dangerous = bool(
        exporter and exporter.cargo_profile == ExporterCargoProfile.PERIGOSA
    )
    return dna_flags_dangerous, exporter_flags_dangerous
