const nodemailer = require("nodemailer");

// Configuración del transporter de Gmail
const createTransporter = () => {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER || "tecardaby@gmail.com", // Configura esto en .env
      pass: process.env.EMAIL_PASSWORD || "rstb looi gmmf kmwx" // Usa contraseña de aplicación de Google
    }
  });
};

// Función genérica para enviar correos
exports.sendMail = async ({ to, subject, text, html }) => {
  const transporter = createTransporter();
  
  const mailOptions = {
    from: `"ERP Sistema" <${process.env.EMAIL_USER || "tecardaby@gmail.com"}>`,
    to,
    subject,
    text,
    html
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

// Enviar correo de recuperación de contraseña
exports.sendPasswordResetEmail = async (to, username, resetToken) => {
  const transporter = createTransporter();
  
  const resetUrl = `https://qaerp.ardabytec.vip/reset-password?token=${resetToken}`;
  
  const mailOptions = {
    from: `"ERP Sistema" <${process.env.EMAIL_USER || "tu-email@gmail.com"}>`,
    to: to,
    subject: "Recuperación de Contraseña - ERP Sistema",
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
              <h2 style="color: #667eea;">Recuperación de Contraseña</h2>
              <p>Hola <strong>${username}</strong>,</p>
              <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en el sistema ERP.</p>
              <p>Para restablecer tu contraseña, haz clic en el siguiente botón:</p>
              <div style="text-align: center;">
                <a href="${resetUrl}" class="button">Restablecer Contraseña</a>
              </div>
              <p><strong>Este enlace expirará en 1 hora.</strong></p>
              <p>Si no solicitaste este cambio, puedes ignorar este correo de forma segura.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="font-size: 12px; color: #666;">
                Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
                <a href="${resetUrl}" style="color: #667eea; word-break: break-all;">${resetUrl}</a>
              </p>
            </div>
            <div class="footer">
              <p>© 2026 ERP PROYECTO - Todos los derechos reservados</p>
            </div>
          </div>
        </body>
      </html>
    `
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

// Enviar correo de confirmación de cambio de contraseña
exports.sendPasswordChangedEmail = async (to, username) => {
  const transporter = createTransporter();
  
  const mailOptions = {
    from: `"ERP Sistema" <${process.env.EMAIL_USER || "tecardaby@gmail.com"}>`,
    to: to,
    subject: "Contraseña Actualizada - ERP Sistema",
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
              <h2 style="color: #10b981;">✓ Contraseña Actualizada</h2>
              <p>Hola <strong>${username}</strong>,</p>
              <p>Tu contraseña ha sido actualizada exitosamente.</p>
              <p>Si no realizaste este cambio, por favor contacta al administrador del sistema inmediatamente.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="font-size: 12px; color: #666;">
                © 2026 ERP PROYECTO - Todos los derechos reservados
              </p>
            </div>
          </div>
        </body>
      </html>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Correo de confirmación enviado:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Error al enviar correo de confirmación:", error);
    throw error;
  }
};
