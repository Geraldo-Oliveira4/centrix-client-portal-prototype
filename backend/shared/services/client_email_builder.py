"""Email composition for the client portal link (Freitas-branded).

Used by send_client_link to email the shareable proposal view link to the client.
"""


def build_guard_rail_block_email(
    client_name: str,
    reference: str | None,
) -> str:
    """Return html_body notifying the client that Freitas reviewed
    their selection and is asking them to choose another proposal (guard rail
    block, ARB-2449).

    Takes a plain reference string (not an ORM object) so the caller can send
    the mail after the DB session closes without a detached-instance risk.

    The email does not embed the analyst's justification — the client sees it in
    the portal (guard_rail_block_reason) when they return to re-pick.
    """
    reference = reference or "N/A"

    html_body = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr>
      <td>
        <table width="600" align="center" cellpadding="0" cellspacing="0"
               style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;
                      box-shadow:0 1px 3px rgba(0,0,0,.1);">
          <tr>
            <td style="background:#1e3a5f;padding:28px 32px;">
              <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-.02em;">
                Freitas COMEX
              </p>
              <p style="margin:6px 0 0;font-size:13px;color:#94a3b8;">
                Cotacao {reference} — escolha outra proposta
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:15px;color:#1e293b;">
                Ola, <strong>{client_name}</strong>,
              </p>
              <p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.6;">
                Nossa equipe revisou a proposta que voce selecionou na cotacao
                <strong>{reference}</strong> e pediu que voce escolha outra opcao. Acesse
                o portal para ver o motivo e selecionar uma nova proposta.
              </p>
              <p style="margin:0;font-size:14px;color:#475569;line-height:1.6;">
                Em caso de duvidas, responda a este e-mail ou fale com o seu contato na
                Freitas COMEX.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 32px;">
              <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.6;">
                As informacoes contidas nesta mensagem sao confidenciais e destinadas
                exclusivamente ao destinatario.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

    return html_body


def build_client_link_email(
    client_name: str,
    quotation,
    portal_url: str,
    observations: str | None,
) -> str:
    """Return html_body for the client proposal link email."""
    modal = quotation.modal.value if quotation.modal else "N/A"
    reference = quotation.reference or "N/A"

    destination = "N/A"
    if quotation.porto_destino:
        destination = ", ".join(quotation.porto_destino)
    elif quotation.aeroporto_destino:
        destination = ", ".join(quotation.aeroporto_destino)

    origin = quotation.origin or "N/A"
    incoterm = quotation.incoterm or "N/A"

    observations_block_html = ""
    if observations:
        observations_block_html = f"""
        <div style="margin:24px 0;padding:16px 20px;background:#f8fafc;border-left:4px solid #1e3a5f;border-radius:4px;">
          <p style="margin:0 0 6px;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;font-weight:600;">
            Mensagem da Freitas COMEX
          </p>
          <p style="margin:0;font-size:14px;color:#1e293b;white-space:pre-wrap;">{observations}</p>
        </div>"""

    html_body = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr>
      <td>
        <table width="600" align="center" cellpadding="0" cellspacing="0"
               style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;
                      box-shadow:0 1px 3px rgba(0,0,0,.1);">

          <!-- Header -->
          <tr>
            <td style="background:#1e3a5f;padding:28px 32px;">
              <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-.02em;">
                Freitas COMEX
              </p>
              <p style="margin:6px 0 0;font-size:13px;color:#94a3b8;">
                Proposta Comercial — {reference}
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:15px;color:#1e293b;">
                Olá, <strong>{client_name}</strong>,
              </p>
              <p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.6;">
                Preparamos as propostas para a sua solicitacao de frete. Acesse o link abaixo
                para visualizar o comparativo completo com todos os detalhes.
              </p>

              <!-- Quotation summary -->
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="margin:0 0 24px;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;">
                <tr style="background:#f8fafc;">
                  <td style="padding:10px 16px;font-size:11px;color:#64748b;text-transform:uppercase;
                             letter-spacing:.05em;font-weight:600;border-bottom:1px solid #e2e8f0;">
                    Resumo da Solicitacao
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size:12px;color:#64748b;padding:3px 0;">Referencia</td>
                        <td style="font-size:12px;color:#1e293b;font-weight:600;text-align:right;padding:3px 0;">{reference}</td>
                      </tr>
                      <tr>
                        <td style="font-size:12px;color:#64748b;padding:3px 0;">Origem</td>
                        <td style="font-size:12px;color:#1e293b;font-weight:600;text-align:right;padding:3px 0;">{origin}</td>
                      </tr>
                      <tr>
                        <td style="font-size:12px;color:#64748b;padding:3px 0;">Destino</td>
                        <td style="font-size:12px;color:#1e293b;font-weight:600;text-align:right;padding:3px 0;">{destination}</td>
                      </tr>
                      <tr>
                        <td style="font-size:12px;color:#64748b;padding:3px 0;">Modal</td>
                        <td style="font-size:12px;color:#1e293b;font-weight:600;text-align:right;padding:3px 0;">{modal}</td>
                      </tr>
                      <tr>
                        <td style="font-size:12px;color:#64748b;padding:3px 0;">Incoterm</td>
                        <td style="font-size:12px;color:#1e293b;font-weight:600;text-align:right;padding:3px 0;">{incoterm}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              {observations_block_html}

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
                <tr>
                  <td align="center">
                    <a href="{portal_url}"
                       style="display:inline-block;padding:14px 32px;background:#1e3a5f;color:#ffffff;
                              font-size:14px;font-weight:600;text-decoration:none;border-radius:6px;
                              letter-spacing:.01em;">
                      Visualizar Propostas
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;font-size:12px;color:#94a3b8;text-align:center;">
                Ou acesse diretamente:
              </p>
              <p style="margin:0;font-size:11px;color:#94a3b8;text-align:center;word-break:break-all;">
                <a href="{portal_url}" style="color:#3b82f6;">{portal_url}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 32px;">
              <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.6;">
                Este link e valido por 30 dias. As informacoes contidas nesta proposta sao
                confidenciais e destinadas exclusivamente ao destinatario. Em caso de duvidas,
                entre em contato com a equipe Freitas COMEX.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

    return html_body
