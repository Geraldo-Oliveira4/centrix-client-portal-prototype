"""Preferências que o CLIENTE declara sobre a própria operação (portal).

ARQUIVO NOVO DO PROTÓTIPO — não existe no Centrix, onde o perfil da operação é
o DNA do Cliente (`QuotationClientDna`), preenchido pelo analista.

Fica separado do DNA de propósito. O DNA é do analista e carrega dado interno da
Freitas (contato responsável, analista designado); o portal não escreve nele.
Aqui mora só o que o cliente edita em "Minhas Preferências" e o que ele pausa em
"Meus Agentes" — ver o docstring da migração 094 para o raciocínio completo.

Uma linha por cliente, e a ausência de linha é o estado normal: nenhum agente
pausado e nenhuma preferência declarada. Nenhum seed popula esta tabela.
"""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from ..base import Base


class PortalClientPreferences(Base):
    __tablename__ = "centrix_portal_client_preferences"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("centrix_quotation_clients.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    # Agentes pré-aprovados pela Freitas que este cliente tirou das próximas
    # RFQs. Lista de UUIDs em texto, mesmo formato de
    # QuotationClientDna.default_agents — é de lá que estes ids saem.
    #
    # É UMA lista só: "pausado" em Meus Agentes e "bloqueado" na blacklist de
    # Minhas Preferências são a mesma afirmação, exposta em duas telas. Não
    # acrescente uma segunda coluna para a blacklist.
    paused_agent_ids: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)

    # Perfil de operação editável pelo cliente. Texto livre: não há catálogo de
    # portos nem enum de incoterm neste schema, e validar contra um inventado
    # aqui prometeria uma checagem que o backend não faz.
    preferred_port: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    default_incoterm: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    uses_insurance: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    cargo_particularities: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    updated_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
