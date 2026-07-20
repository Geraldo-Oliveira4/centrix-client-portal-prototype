# shared/services/audit_logger.py
#
# Audit logger de negócio — registra ações de usuários no banco de dados
# para rastreabilidade interna da aplicação.
#
# Diferente de shared/observability.py (Powertools Logger/Tracer), que é
# voltado à observabilidade técnica de infraestrutura (CloudWatch, X-Ray),
# este módulo persiste um histórico de ações auditáveis por usuários finais.

from typing import Optional, Dict, Any

from shared.database.connection import get_session
from shared.database.repositories import log_repository


class CentrixActionType:
    USER_CREATED = 'USER_CREATED'
    USER_DELETED = 'USER_DELETED'
    SETTINGS_UPDATED = 'SETTINGS_UPDATED'
    PRE_REGISTER_ADD = 'PRE_REGISTER_ADD'
    PRE_REGISTER_DELETE = 'PRE_REGISTER_DELETE'
    ROLE_TOGGLE = 'ROLE_TOGGLE'
    FORCE_PASSWORD_RESET = 'FORCE_PASSWORD_RESET'
    SDR_CREATED = 'SDR_CREATED'
    SDR_DELETED = 'SDR_DELETED'
    SDR_RESTARTED = 'SDR_RESTARTED'
    SDR_STATUS_CHECKED = 'SDR_STATUS_CHECKED'


class CentrixAuditLogger:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(CentrixAuditLogger, cls).__new__(cls)
        return cls._instance

    def log_action(
        self,
        action_type: str,
        user_id: str,
        details: Dict[str, Any],
        status: str = 'SUCCESS',
        error_message: Optional[str] = None,
    ) -> None:
        try:
            with get_session() as session:
                log_repository.add(
                    session,
                    action_type=action_type,
                    user_id=user_id,
                    details=details,
                    status=status,
                    error_message=error_message,
                )
        except Exception as e:
            print(f"Error logging audit action: {e}")


audit_logger = CentrixAuditLogger()
