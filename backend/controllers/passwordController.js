const crypto = require("crypto");
const UserModel = require("../models/userModel");
const emailService = require("../services/emailService");

// Solicitar recuperación de contraseña
exports.requestPasswordReset = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ msg: "El email es requerido" });
  }

  try {
    // Verificar que el email exista en la base de datos
    const user = await UserModel.findByEmail(email);

    if (!user) {
      // Por seguridad, no revelamos si el email existe o no
      return res.json({ 
        msg: "Si el email está registrado, recibirás un correo con instrucciones para recuperar tu contraseña" 
      });
    }

    // Generar token único
    const resetToken = crypto.randomBytes(32).toString("hex");
    
    // Token expira en 1 hora
    const expiresAt = new Date(Date.now() + 3600000); // 1 hora

    // Guardar token en la base de datos
    await UserModel.saveResetToken(user.User_Id, resetToken, expiresAt);

    // Enviar correo con el link de recuperación
    await emailService.sendPasswordResetEmail(user.Email, user.Username, resetToken);

    res.json({ 
      msg: "Si el email está registrado, recibirás un correo con instrucciones para recuperar tu contraseña" 
    });

  } catch (error) {
    console.error("Error en requestPasswordReset:", error);
    res.status(500).json({ msg: "Error al procesar la solicitud" });
  }
};

// Verificar si el token es válido
exports.verifyResetToken = async (req, res) => {
  const { token } = req.params;

  if (!token) {
    return res.status(400).json({ msg: "Token requerido" });
  }

  try {
    const tokenData = await UserModel.verifyResetToken(token);

    if (!tokenData) {
      return res.status(400).json({ msg: "Token inválido o expirado" });
    }

    res.json({ 
      valid: true, 
      username: tokenData.Username 
    });

  } catch (error) {
    console.error("Error en verifyResetToken:", error);
    res.status(500).json({ msg: "Error al verificar el token" });
  }
};

// Restablecer contraseña
exports.resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ msg: "Token y nueva contraseña son requeridos" });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ msg: "La contraseña debe tener al menos 6 caracteres" });
  }

  try {
    // Verificar token
    const tokenData = await UserModel.verifyResetToken(token);

    if (!tokenData || !tokenData.User_Id || isNaN(tokenData.User_Id)) {
      return res.status(400).json({ msg: "Token inválido o usuario no encontrado" });
    }

    // Actualizar contraseña
    await UserModel.updatePassword(tokenData.User_Id, newPassword);

    // Marcar token como usado
    await UserModel.markTokenAsUsed(token);

    // Enviar correo de confirmación
    await emailService.sendPasswordChangedEmail(tokenData.Email, tokenData.Username);

    res.json({ msg: "Contraseña actualizada exitosamente" });

  } catch (error) {
    console.error("Error en resetPassword:", error);
    res.status(500).json({ msg: error.message || "Error al restablecer la contraseña" });
  }
};
