from enum import Enum


class TipoCotacao(str, Enum):
    REAL = "REAL"
    ESTIMATIVA = "ESTIMATIVA"


class Currency(str, Enum):
    BRL = "BRL"
    USD = "USD"
    EUR = "EUR"
    GBP = "GBP"
    CNY = "CNY"
    ARS = "ARS"
    CLP = "CLP"
    MXN = "MXN"
    CHF = "CHF"


class QuotationState(str, Enum):
    TRIAGEM_IA = "TRIAGEM_IA"
    AGUARDANDO_DADOS = "AGUARDANDO_DADOS"
    COTANDO = "COTANDO"
    PARA_ANALISE = "PARA_ANALISE"
    REVISAO_AGENTE = "REVISAO_AGENTE"
    ENVIADA_CLIENTE = "ENVIADA_CLIENTE"
    APROVADA_PELO_CLIENTE = "APROVADA_PELO_CLIENTE"
    FECHADA = "FECHADA"
    DECLINADA = "DECLINADA"
    CANCELADO = "CANCELADO"


# States in which a quotation no longer accepts agent activity (uploads, proposals, etc.).
# Centralised here so all public lambdas stay in sync when new terminal states are added.
QUOTATION_TERMINAL_STATES: frozenset[QuotationState] = frozenset({
    QuotationState.FECHADA,
    QuotationState.DECLINADA,
    QuotationState.CANCELADO,
})


class Modal(str, Enum):
    AEREO = "AEREO"
    MARITIMO = "MARITIMO"
    RODOVIARIO = "RODOVIARIO"


class ServiceType(str, Enum):
    IMPORTACAO = "IMPORTACAO"
    EXPORTACAO = "EXPORTACAO"


class TipoEmbarque(str, Enum):
    FCL = "FCL"
    LCL = "LCL"
    BREAK_BULK = "BREAK_BULK"


class CargaPerigosa(str, Enum):
    NAO = "NAO"
    RA = "RA"
    IMO = "IMO"


class RouteType(str, Enum):
    DIRETA = "DIRETA"
    TRANSBORDO = "TRANSBORDO"


class TipoContainer(str, Enum):
    STANDARD_20 = "STANDARD_20"
    STANDARD_40 = "STANDARD_40"
    HIGH_CUBE_40 = "HIGH_CUBE_40"
    NOR_40 = "NOR_40"
    HARDTOP_20 = "HARDTOP_20"
    HARDTOP_40 = "HARDTOP_40"
    HARDTOP_HIGH_CUBE_40 = "HARDTOP_HIGH_CUBE_40"
    OPEN_TOP_20 = "OPEN_TOP_20"
    OPEN_TOP_40 = "OPEN_TOP_40"
    OPEN_TOP_HIGH_CUBE_40 = "OPEN_TOP_HIGH_CUBE_40"
    FLATRACK_20 = "FLATRACK_20"
    FLATRACK_40 = "FLATRACK_40"
    PLATFORM_20 = "PLATFORM_20"
    PLATFORM_40 = "PLATFORM_40"
    REFRIGERATED_20 = "REFRIGERATED_20"
    REFRIGERATED_40 = "REFRIGERATED_40"
    BULK_20 = "BULK_20"
    TANK_20 = "TANK_20"


class TipoEmbalagem(str, Enum):
    BARRICA_FIBRA_VIDRO = "BARRICA_FIBRA_VIDRO"
    BARRICA_METAL = "BARRICA_METAL"
    BARRICA_OUTROS = "BARRICA_OUTROS"
    BARRICA_PAPELAO = "BARRICA_PAPELAO"
    BARRICA_PLASTICO = "BARRICA_PLASTICO"
    BAU_MADEIRA = "BAU_MADEIRA"
    BAU_METAL = "BAU_METAL"
    BAU_OUTROS = "BAU_OUTROS"
    BIG_BAG = "BIG_BAG"
    BLOCO = "BLOCO"
    BOBINA = "BOBINA"
    BOMBONA = "BOMBONA"
    BOTIJAO = "BOTIJAO"
    CAIXA = "CAIXA"
    CAIXA_ISOPOR = "CAIXA_ISOPOR"
    CAIXA_MADEIRA = "CAIXA_MADEIRA"
    CAIXA_METAL = "CAIXA_METAL"
    CAIXA_OUTROS = "CAIXA_OUTROS"
    CAIXA_PAPELAO = "CAIXA_PAPELAO"
    CAIXA_PAPELAO_CORRUGADO = "CAIXA_PAPELAO_CORRUGADO"
    CAIXA_PLASTICO = "CAIXA_PLASTICO"
    CARGA_SOLTA = "CARGA_SOLTA"
    CARRETEL = "CARRETEL"
    CILINDRO = "CILINDRO"
    CINTADO = "CINTADO"
    ENGRADADO_MADEIRA = "ENGRADADO_MADEIRA"
    ENGRADADO_OUTROS = "ENGRADADO_OUTROS"
    ENGRADADO_PLASTICO = "ENGRADADO_PLASTICO"
    ENVELOPE = "ENVELOPE"
    ESTOJO = "ESTOJO"
    ESTRADO = "ESTRADO"
    FARDO = "FARDO"
    FRASCO = "FRASCO"
    GALAO_METAL = "GALAO_METAL"
    GALAO_OUTROS = "GALAO_OUTROS"
    GALAO_PLASTICO = "GALAO_PLASTICO"
    GRANEL = "GRANEL"
    LATA = "LATA"
    MALA = "MALA"
    MALETA = "MALETA"
    MODAL_OCTABIN = "MODAL_OCTABIN"
    OUTRO = "OUTRO"
    PACOTE = "PACOTE"
    PALLET = "PALLET"
    PECA = "PECA"
    ROLO = "ROLO"
    SACA = "SACA"
    SACA_ANIAGEM = "SACA_ANIAGEM"
    SACA_COURO = "SACA_COURO"
    SACA_LONA = "SACA_LONA"
    SACO_NYLON = "SACO_NYLON"
    SACO_OUTROS = "SACO_OUTROS"
    SACO_PAPEL = "SACO_PAPEL"
    SACO_PAPELAO = "SACO_PAPELAO"
    SACO_PLASTICO = "SACO_PLASTICO"
    SACOLA = "SACOLA"
    SAND_BAG = "SAND_BAG"
    TAMBOR_METAL = "TAMBOR_METAL"
    TAMBOR_OUTROS = "TAMBOR_OUTROS"
    TAMBOR_PAPELAO = "TAMBOR_PAPELAO"
    TAMBOR_PLASTICO = "TAMBOR_PLASTICO"
    TUBO = "TUBO"


class PesoUnidade(str, Enum):
    KG = "KG"
    LB = "LB"


class DimensaoUnidade(str, Enum):
    CM = "CM"
    M = "M"
    MM = "MM"
    POL = "POL"


class AuditCategory(str, Enum):
    SEGURO = "SEGURO"
    ROTA_DESTINO = "ROTA_DESTINO"
    COTACAO_INCOMPLETA = "COTACAO_INCOMPLETA"
    PARTICULARIDADES_IGNORADAS = "PARTICULARIDADES_IGNORADAS"
    DNA_COMPLIANCE = "DNA_COMPLIANCE"


class Severity(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class ClientTier(str, Enum):
    PREMIUM = "PREMIUM"
    POTENCIAL = "POTENCIAL"
    CRESCIMENTO = "CRESCIMENTO"
    MANTER = "MANTER"


class LogisticsType(str, Enum):
    COTACAO = "COTACAO"
    TORRE_DE_CONTROLE = "TORRE_DE_CONTROLE"
    PREMIUM = "PREMIUM"


class InsuranceResponsibility(str, Enum):
    FREITAS = "FREITAS"
    CLIENTE = "CLIENTE"
    NAO_INCLUSO = "NAO_INCLUSO"
    AGENTE_DE_CARGAS = "AGENTE_DE_CARGAS"


class ExporterCargoProfile(str, Enum):
    GERAL = "GERAL"
    PERIGOSA = "PERIGOSA"
    TEMP_CONTROLADA = "TEMP_CONTROLADA"


class PriceOrPerformance(str, Enum):
    PRECO = "PRECO"
    PERFORMANCE = "PERFORMANCE"


class UrgencyLevel(str, Enum):
    URGENTE = "URGENTE"
    VIP = "VIP"
    ALTA = "ALTA"
    NORMAL = "NORMAL"


class DeclineReason(str, Enum):
    PRECO = "PRECO"
    TRANSIT_TIME = "TRANSIT_TIME"
    SEM_RESPOSTA = "SEM_RESPOSTA"
    NAO_VAI_IMPORTAR = "NAO_VAI_IMPORTAR"
    ALTERNATIVA_OUTRO_PRESTADOR = "ALTERNATIVA_OUTRO_PRESTADOR"
    VALIDADE_EXPIRADA = "VALIDADE_EXPIRADA"
    OUTROS = "OUTROS"


class SIStatus(str, Enum):
    RASCUNHO = "RASCUNHO"
    ENVIADA = "ENVIADA"
    # Set when the quotation that owns this SI is reopened (FECHADA -> COTANDO)
    # after the SI was already generated, so create_shipment_instruction can
    # issue a fresh draft for the new agent instead of returning the stale one.
    CANCELADA = "CANCELADA"


class ExtractionStatus(str, Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class ReviewStatus(str, Enum):
    PENDING = "PENDING"
    RESOLVED = "RESOLVED"
    DISMISSED = "DISMISSED"


class GuardRailDecision(str, Enum):
    """Analyst decision on a portal quotation held by the guard rail.

    null (no row value) = pending analyst review. A persisted decision
    overrides the computed guard-rail evaluation: RELEASED unlocks client
    approval, BLOCKED keeps it locked (see shared/domain/guard_rail.py).
    """
    RELEASED = "RELEASED"
    BLOCKED = "BLOCKED"


class AuditResultado(str, Enum):
    APROVADO = "aprovado"
    DIVERGENTE = "divergente"
    BLOQUEADO = "bloqueado"


class AuditAcaoTomada(str, Enum):
    PASSIVO = "passivo"
    ALERTA = "alerta"
    BLOQUEIO = "bloqueio"
    SUGESTAO_APLICADA = "sugestao_aplicada"


class AuditResolucaoTipo(str, Enum):
    CORRECAO_APLICADA = "correcao_aplicada"
    JUSTIFICADA_E_SEGUIU = "justificada_e_seguiu"
    CANCELADA = "cancelada"
