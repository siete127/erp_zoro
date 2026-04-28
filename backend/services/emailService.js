const nodemailer = require("nodemailer");
const { getRequiredEnv } = require("../config/env");

const emailUser = getRequiredEnv("EMAIL_USER");
const emailPassword = getRequiredEnv("EMAIL_PASSWORD");
const frontendUrl = getRequiredEnv("FRONTEND_URL").replace(/\/$/, "");

const createTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: emailUser,
      pass: emailPassword,
    },
  });
};

exports.sendMail = async ({ to, subject, text, html }) => {
  const transporter = createTransporter();

  const mailOptions = {
    from: `"ERP Sistema" <${emailUser}>`,
    to,
    subject,
    text,
    html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Correo enviado:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Error al enviar correo:", error);
    throw error;
  }
};

exports.sendPasswordResetEmail = async (to, username, resetToken) => {
  const transporter = createTransporter();
  const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

  const mailOptions = {
    from: `"ERP Sistema" <${emailUser}>`,
    to,
    subject: "Recuperacion de Contrasena - ERP Sistema",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
            }
            .container {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              padding: 20px;
              border-radius: 10px;
            }
            .content {
              background: white;
              padding: 30px;
              border-radius: 8px;
            }
            .button {
              display: inline-block;
              padding: 12px 30px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              text-decoration: none;
              border-radius: 5px;
              margin: 20px 0;
              font-weight: bold;
            }
            .footer {
              text-align: center;
              margin-top: 20px;
              font-size: 12px;
              color: #666;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="content">
              <h2 style="color: #667eea;">Recuperacion de Contrasena</h2>
              <p>Hola <strong>${username}</strong>,</p>
              <p>Recibimos una solicitud para restablecer la contrasena de tu cuenta en el sistema ERP.</p>
              <p>Para restablecer tu contrasena, haz clic en el siguiente boton:</p>
              <div style="text-align: center;">
                <a href="${resetUrl}" class="button">Restablecer Contrasena</a>
              </div>
              <p><strong>Este enlace expirara en 1 hora.</strong></p>
              <p>Si no solicitaste este cambio, puedes ignorar este correo de forma segura.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="font-size: 12px; color: #666;">
                Si el boton no funciona, copia y pega este enlace en tu navegador:<br>
                <a href="${resetUrl}" style="color: #667eea; word-break: break-all;">${resetUrl}</a>
              </p>
            </div>
            <div class="footer">
              <p>&copy; 2026 ERP PROYECTO - Todos los derechos reservados</p>
            </div>
          </div>
        </body>
      </html>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Correo enviado:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Error al enviar correo:", error);
    throw error;
  }
};

exports.sendPasswordChangedEmail = async (to, username) => {
  const transporter = createTransporter();

  const mailOptions = {
    from: `"ERP Sistema" <${emailUser}>`,
    to,
    subject: "Contrasena Actualizada - ERP Sistema",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
            }
            .container {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              padding: 20px;
              border-radius: 10px;
            }
            .content {
              background: white;
              padding: 30px;
              border-radius: 8px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="content">
              <h2 style="color: #10b981;">Contrasena Actualizada</h2>
              <p>Hola <strong>${username}</strong>,</p>
              <p>Tu contrasena ha sido actualizada exitosamente.</p>
              <p>Si no realizaste este cambio, por favor contacta al administrador del sistema inmediatamente.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="font-size: 12px; color: #666;">
                &copy; 2026 ERP PROYECTO - Todos los derechos reservados
              </p>
            </div>
          </div>
        </body>
      </html>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Correo de confirmacion enviado:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Error al enviar correo de confirmacion:", error);
    throw error;
  }
};
