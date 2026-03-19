const { pool, sql } = require("../config/db");
const bcrypt = require("bcryptjs");

class UserModel {
  // Buscar usuario por email
  static async findByEmail(email) {
    try {
      await pool.connect();
      const result = await pool.request()
        .input("email", sql.VarChar, email)
        .query("SELECT * FROM ERP_USERS WHERE Email = @email AND IsActive = 1");
      
      return result.recordset[0] || null;
    } catch (error) {
      throw error;
    }
  }

  // Buscar usuario por username
  static async findByUsername(username) {
    try {
      await pool.connect();
      const result = await pool.request()
        .input("username", sql.VarChar, username)
        .query("SELECT * FROM ERP_USERS WHERE Username = @username AND IsActive = 1");
      
      return result.recordset[0] || null;
    } catch (error) {
      throw error;
    }
  }

  // Actualizar contraseña
  static async updatePassword(userId, newPassword) {
    if (!userId || isNaN(userId)) {
      throw new Error("userId inválido");
    }
    try {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await pool.connect();
      
      await pool.request()
        .input("userId", sql.Int, userId)
        .input("password", sql.VarChar, hashedPassword)
        .query("UPDATE ERP_USERS SET Password = @password WHERE User_Id = @userId");
      
      return true;
    } catch (error) {
      throw error;
    }
  }

  // Guardar token de recuperación
  static async saveResetToken(userId, token, expiresAt) {
    try {
      await pool.connect();
      
      // Primero verificamos si existe la tabla de tokens
      await pool.request().query(`
        IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='PASSWORD_RESET_TOKENS' AND xtype='U')
        CREATE TABLE PASSWORD_RESET_TOKENS (
          Token_Id INT IDENTITY(1,1) PRIMARY KEY,
          User_Id INT NOT NULL,
          Token VARCHAR(255) NOT NULL,
          ExpiresAt DATETIME NOT NULL,
          Used BIT DEFAULT 0,
          CreatedAt DATETIME DEFAULT GETDATE(),
          FOREIGN KEY (User_Id) REFERENCES ERP_USERS(User_Id)
        )
      `);

      // Guardamos el token
      await pool.request()
        .input("userId", sql.Int, userId)
        .input("token", sql.VarChar, token)
        .input("expiresAt", sql.DateTime, expiresAt)
        .query(`
          INSERT INTO PASSWORD_RESET_TOKENS (User_Id, Token, ExpiresAt)
          VALUES (@userId, @token, @expiresAt)
        `);
      
      return true;
    } catch (error) {
      throw error;
    }
  }

  // Verificar token de recuperación
  static async verifyResetToken(token) {
    try {
      await pool.connect();
      const result = await pool.request()
        .input("token", sql.VarChar, token)
        .query(`
          SELECT prt.*, u.User_Id, u.Email, u.Username
          FROM PASSWORD_RESET_TOKENS prt
          INNER JOIN ERP_USERS u ON prt.User_Id = u.User_Id
          WHERE prt.Token = @token 
            AND prt.Used = 0 
            AND prt.ExpiresAt > GETDATE()
        `);
      console.log("Resultado verifyResetToken:", result.recordset);
      const record = result.recordset[0];
      if (record && Array.isArray(record.User_Id)) {
        record.User_Id = record.User_Id[0];
      }
      return record || null;
    } catch (error) {
      throw error;
    }
  }

  // Marcar token como usado
  static async markTokenAsUsed(token) {
    try {
      await pool.connect();
      
      await pool.request()
        .input("token", sql.VarChar, token)
        .query("UPDATE PASSWORD_RESET_TOKENS SET Used = 1 WHERE Token = @token");
      
      return true;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = UserModel;
