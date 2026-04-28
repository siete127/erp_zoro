import smtplib
import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

EMAIL_USER = os.getenv("EMAIL_USER", "noreply@example.com")
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")


def _send(to: str, subject: str, html: str):
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"ERP Sistema <{EMAIL_USER}>"
    msg["To"] = to
    msg.attach(MIMEText(html, "html"))
    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(EMAIL_USER, EMAIL_PASSWORD)
        server.sendmail(EMAIL_USER, to, msg.as_string())


def send_password_reset_email(to: str, username: str, reset_token: str):
    reset_url = f"{FRONTEND_URL}/reset-password?token={reset_token}"
    html = f"""
    <!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:linear-gradient(135deg,#667eea,#764ba2);padding:20px;border-radius:10px">
        <div style="background:white;padding:30px;border-radius:8px">
          <h2 style="color:#667eea">Recuperación de Contraseña</h2>
          <p>Hola <strong>{username}</strong>,</p>
          <p>Recibimos una solicitud para restablecer tu contraseña.</p>
          <div style="text-align:center">
            <a href="{reset_url}" style="display:inline-block;padding:12px 30px;background:linear-gradient(135deg,#667eea,#764ba2);color:white;text-decoration:none;border-radius:5px;font-weight:bold">
              Restablecer Contraseña
            </a>
          </div>
          <p><strong>Este enlace expirará en 1 hora.</strong></p>
          <p>Si no solicitaste este cambio, ignora este correo.</p>
        </div>
      </div>
    </body></html>
    """
    _send(to, "Recuperación de Contraseña - ERP Sistema", html)


def send_password_changed_email(to: str, username: str):
    html = f"""
    <!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:linear-gradient(135deg,#667eea,#764ba2);padding:20px;border-radius:10px">
        <div style="background:white;padding:30px;border-radius:8px">
          <h2 style="color:#10b981">&#10003; Contraseña Actualizada</h2>
          <p>Hola <strong>{username}</strong>,</p>
          <p>Tu contraseña ha sido actualizada exitosamente.</p>
          <p>Si no realizaste este cambio, contacta al administrador inmediatamente.</p>
        </div>
      </div>
    </body></html>
    """
    _send(to, "Contraseña Actualizada - ERP Sistema", html)


def send_price_approval_email(to: str, request_id: int, client_name: str, product_name: str, new_price: float, approve_link: str, reject_link: str):
    html = f"""
    <!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:linear-gradient(135deg,#667eea,#764ba2);padding:20px;border-radius:10px">
        <div style="background:white;padding:30px;border-radius:8px">
          <h2 style="color:#667eea">&#128276; Solicitud de Aprobación - Cambio de Precio</h2>
          <p>Se ha solicitado un cambio de precio que requiere su aprobación.</p>
          <div style="background:#f3f4f6;padding:15px;border-radius:5px;margin:15px 0">
            <p><strong>Cliente:</strong> {client_name}</p>
            <p><strong>Producto:</strong> {product_name}</p>
            <p><strong>Nuevo Precio:</strong> <span style="color:#10b981;font-size:18px;font-weight:bold">${new_price:.2f}</span></p>
          </div>
          <p><strong>&#9888; Importante:</strong> Se requiere la aprobación de 2 personas.</p>
          <div style="text-align:center">
            <a href="{approve_link}" style="display:inline-block;padding:12px 30px;background:#10b981;color:white;text-decoration:none;border-radius:5px;margin:10px 5px;font-weight:bold">&#10003; Aprobar</a>
            <a href="{reject_link}" style="display:inline-block;padding:12px 30px;background:#ef4444;color:white;text-decoration:none;border-radius:5px;margin:10px 5px;font-weight:bold">&#10007; Rechazar</a>
          </div>
        </div>
      </div>
    </body></html>
    """
    _send(to, "Solicitud de Aprobación - Cambio de Precio", html)


def send_vacation_request_email(to: str, employee_name: str, fecha_inicio: str, fecha_fin: str, dias: int, razon: str = ""):
    """Notifica al empleado que su solicitud fue enviada."""
    html = f"""
    <!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:linear-gradient(135deg,#1b3d86,#2a5fc4);padding:20px;border-radius:10px">
        <div style="background:white;padding:30px;border-radius:8px">
          <h2 style="color:#1b3d86">Solicitud de Vacaciones Recibida</h2>
          <p>Hola <strong>{employee_name}</strong>,</p>
          <p>Tu solicitud de vacaciones ha sido enviada y esta pendiente de aprobacion.</p>
          <div style="background:#f3f4f6;padding:15px;border-radius:5px;margin:15px 0">
            <p><strong>Fecha inicio:</strong> {fecha_inicio}</p>
            <p><strong>Fecha fin:</strong> {fecha_fin}</p>
            <p><strong>Dias solicitados:</strong> <span style="color:#1b3d86;font-weight:bold">{dias} dias</span></p>
            {"<p><strong>Motivo:</strong> " + razon + "</p>" if razon else ""}
          </div>
          <p style="color:#6b7a96;font-size:13px">Te notificaremos cuando tu solicitud sea revisada por el administrador.</p>
        </div>
      </div>
    </body></html>
    """
    _send(to, "Solicitud de Vacaciones Recibida - ERP Sistema", html)


def send_vacation_approved_email(to: str, employee_name: str, fecha_inicio: str, fecha_fin: str, dias: int, importe: float = 0):
    """Notifica al empleado que su vacacion fue aprobada."""
    importe_str = f"${importe:,.2f} MXN" if importe > 0 else "por calcular"
    html = f"""
    <!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:linear-gradient(135deg,#059669,#10b981);padding:20px;border-radius:10px">
        <div style="background:white;padding:30px;border-radius:8px">
          <h2 style="color:#059669">&#10003; Vacaciones Aprobadas</h2>
          <p>Hola <strong>{employee_name}</strong>,</p>
          <p>Tus vacaciones han sido <strong style="color:#059669">aprobadas</strong>.</p>
          <div style="background:#f0fdf4;padding:15px;border-radius:5px;margin:15px 0;border-left:4px solid #059669">
            <p><strong>Fecha inicio:</strong> {fecha_inicio}</p>
            <p><strong>Fecha fin:</strong> {fecha_fin}</p>
            <p><strong>Dias aprobados:</strong> <span style="color:#059669;font-weight:bold">{dias} dias</span></p>
            <p><strong>Importe en nomina:</strong> <span style="color:#1b3d86;font-weight:bold">{importe_str}</span></p>
          </div>
          <p style="color:#6b7a96;font-size:13px">El monto sera reflejado en tu proximo periodo de nomina.</p>
        </div>
      </div>
    </body></html>
    """
    _send(to, "Vacaciones Aprobadas - ERP Sistema", html)


def send_vacation_rejected_email(to: str, employee_name: str, fecha_inicio: str, fecha_fin: str, dias: int, observaciones: str = ""):
    """Notifica al empleado que su vacacion fue rechazada."""
    html = f"""
    <!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:linear-gradient(135deg,#dc2626,#ef4444);padding:20px;border-radius:10px">
        <div style="background:white;padding:30px;border-radius:8px">
          <h2 style="color:#dc2626">Solicitud de Vacaciones No Aprobada</h2>
          <p>Hola <strong>{employee_name}</strong>,</p>
          <p>Tu solicitud de vacaciones no ha podido ser aprobada en este momento.</p>
          <div style="background:#fef2f2;padding:15px;border-radius:5px;margin:15px 0;border-left:4px solid #dc2626">
            <p><strong>Fecha inicio:</strong> {fecha_inicio}</p>
            <p><strong>Fecha fin:</strong> {fecha_fin}</p>
            <p><strong>Dias solicitados:</strong> {dias} dias</p>
            {"<p><strong>Motivo:</strong> " + observaciones + "</p>" if observaciones else ""}
          </div>
          <p style="color:#6b7a96;font-size:13px">Si tienes dudas, comunicate con el area de Recursos Humanos.</p>
        </div>
      </div>
    </body></html>
    """
    _send(to, "Solicitud de Vacaciones No Aprobada - ERP Sistema", html)


def send_vacation_synced_email(to: str, employee_name: str, dias: int, importe: float, periodo: str = ""):
    """Notifica al empleado que su pago de vacaciones fue aplicado a nomina."""
    html = f"""
    <!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:linear-gradient(135deg,#1b3d86,#2a5fc4);padding:20px;border-radius:10px">
        <div style="background:white;padding:30px;border-radius:8px">
          <h2 style="color:#1b3d86">Pago de Vacaciones Aplicado</h2>
          <p>Hola <strong>{employee_name}</strong>,</p>
          <p>Tu pago de vacaciones ha sido aplicado en el sistema de nomina.</p>
          <div style="background:#eff6ff;padding:15px;border-radius:5px;margin:15px 0;border-left:4px solid #1b3d86">
            <p><strong>Dias de vacaciones:</strong> {dias} dias</p>
            <p><strong>Importe aplicado:</strong> <span style="color:#059669;font-size:18px;font-weight:bold">${importe:,.2f} MXN</span></p>
            {"<p><strong>Periodo de nomina:</strong> " + periodo + "</p>" if periodo else ""}
          </div>
          <p style="color:#6b7a96;font-size:13px">El importe aparecera reflejado en tu recibo de nomina.</p>
        </div>
      </div>
    </body></html>
    """
    _send(to, "Pago de Vacaciones Aplicado en Nomina - ERP Sistema", html)


def send_multi_price_approval_email(to: str, request_id: int, client_name: str, products: list, approve_link: str, reject_link: str):
    rows = "".join(
        f"<tr><td style='padding:12px'>{p.get('productName','')}</td>"
        f"<td style='padding:12px;text-align:center;color:#666'>${float(p.get('currentPrice') or 0):.2f}</td>"
        f"<td style='padding:12px;text-align:center;color:#059669;font-weight:bold'>${float(p.get('newPrice',0)):.2f}</td></tr>"
        for p in products
    )
    html = f"""
    <!DOCTYPE html><html><body style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto">
      <div style="background:linear-gradient(135deg,#667eea,#764ba2);padding:20px;border-radius:10px">
        <div style="background:white;padding:30px;border-radius:8px">
          <h2 style="color:#667eea">&#128276; Solicitud de Aprobación - Cambios de Precio</h2>
          <div style="background:#f3f4f6;padding:15px;border-radius:5px;margin:15px 0">
            <p><strong>Cliente:</strong> {client_name}</p>
            <p><strong>Productos:</strong> <span style="color:#667eea;font-size:18px;font-weight:bold">{len(products)} productos</span></p>
          </div>
          <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb">
            <thead style="background:#f3f4f6">
              <tr><th style="padding:15px;text-align:left">Producto</th><th style="padding:15px">Precio Actual</th><th style="padding:15px">Precio Nuevo</th></tr>
            </thead>
            <tbody>{rows}</tbody>
          </table>
          <div style="text-align:center;margin-top:30px">
            <a href="{approve_link}" style="display:inline-block;padding:12px 30px;background:#10b981;color:white;text-decoration:none;border-radius:5px;margin:10px 5px;font-weight:bold">&#10003; Aprobar</a>
            <a href="{reject_link}" style="display:inline-block;padding:12px 30px;background:#ef4444;color:white;text-decoration:none;border-radius:5px;margin:10px 5px;font-weight:bold">&#10007; Rechazar</a>
          </div>
        </div>
      </div>
    </body></html>
    """
    _send(to, f"Solicitud de Aprobación - Cambios de Precio ({len(products)} productos)", html)
