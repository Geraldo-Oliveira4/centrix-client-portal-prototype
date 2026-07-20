from enum import Enum


class EmbarqueState(str, Enum):
    """Lifecycle states of an Embarque (shipment).

    The five primary states mirror the Inova Kanban columns. The two exception
    states (POSTERGADO, BOOKING_DIVERGENTE) feed the "Central de Acoes Urgentes"
    view. ANALISE_BOOKING is Centrix-only: it never triggers a PATCH on the Inova
    API (the process stays "Liberado / Ag. embarque" on Inova while the analyst
    audits the BL/AWB internally).

    Values are lowercase to match the PostgreSQL enum type, so columns using this
    enum must set ``values_callable``.
    """

    SOLICITADO = "solicitado"
    AGUARDANDO_PRONTIDAO = "aguardando_prontidao"
    COLETADO = "coletado"
    ANALISE_BOOKING = "analise_booking"
    EMBARCADO = "embarcado"
    # Exception states (not part of the happy path)
    POSTERGADO = "postergado"
    BOOKING_DIVERGENTE = "booking_divergente"


# Exception states surfaced in the "Central de Acoes Urgentes" view.
# Centralised here so the kanban handler and state machine stay in sync.
EMBARQUE_EXCEPTION_STATES: frozenset[EmbarqueState] = frozenset({
    EmbarqueState.POSTERGADO,
    EmbarqueState.BOOKING_DIVERGENTE,
})


# PurchaseOrderState and TipoOcorrencia are defined here for design reference only.
# Their PostgreSQL enum types DO NOT EXIST in the database yet.
# DO NOT use them in Lambda handlers or SQLAlchemy column definitions — they will
# raise a DB error at first write. They become safe to use after the migrations
# that create the PurchaseOrder and Followup tables (GE Fase 1/2).
class PurchaseOrderState(str, Enum):
    """States of a PurchaseOrder (first-class entity, per Victor's request).

    Six states; transitions may be derived automatically from the embarque state
    or set manually. Defined here for the foundation; the PG type and the
    PurchaseOrder table are created in a later migration (Fase 1, separate task).
    """

    ABERTA = "aberta"
    EM_PRODUCAO = "em_producao"
    PRONTA_PARCIAL = "pronta_parcial"
    PRONTA_TOTAL = "pronta_total"
    COLETADA = "coletada"
    EMBARCADA = "embarcada"


class TipoDespacho(str, Enum):
    """Dispatch style of a process ("Estilo de processo" in the UI).

    Single field shared between the form label and the model (decided at the
    Sprint 8 kick-off, ARB-2283 items 1/2). Name == value, so ``values_callable``
    is optional for columns using this enum.
    """

    DIRETO = "DIRETO"
    CONSOLIDADO = "CONSOLIDADO"


class FollowupOrigem(str, Enum):
    """Source of a Followup record.

    Extends str so instances compare equal to their raw string value, making
    them safe to pass to plain String columns without calling .value.
    """

    MANUAL = "MANUAL"
    AUTOMATICO = "AUTOMATICO"


# See guard comment above PurchaseOrderState — same constraint applies here.
class TipoOcorrencia(str, Enum):
    """Follow-up occurrence categories registered against an embarque.

    Grounded in the real occurrence categories from the Operational Quality
    Report (maio/2026) and the "Casos de Uso Excecoes - GE" document. Defined here
    for the foundation; the PG type and the Followup table are created in a later
    migration (Fase 2, separate task), so the exact set can still be refined when
    Followup is implemented.
    """

    AGUARDANDO_NCM = "aguardando_ncm"
    LICENCIAMENTO = "licenciamento"
    BOOKING_POSTERGADO = "booking_postergado"
    DOCUMENTO_FALTANTE = "documento_faltante"
    DOCUMENTO_DIVERGENTE = "documento_divergente"
    BOOKING_DIVERGENTE = "booking_divergente"
    ARMAZEM_INCORRETO = "armazem_incorreto"
    TRATAMENTO_ADMINISTRATIVO = "tratamento_administrativo"
    OUTROS = "outros"
