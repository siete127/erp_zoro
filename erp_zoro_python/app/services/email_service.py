import smtplib
import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

EMAIL_USER = os.getenv("EMAIL_USER", "tecardaby@gmail.com")
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://qaerp.ardabytec.vip")
BACKEND_URL = os.getenv("BACKEND_URL", "https://qaerp.ardabytec.vip")


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
