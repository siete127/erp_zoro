const { pool, sql } = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

exports.login = async (req, res) => {
  const { username, password } = req.body;

  try {
    await pool.connect();

    const result = await pool.request()
      .input("username", sql.VarChar, username)
      .query("SELECT * FROM ERP_USERS WHERE Username = @username AND IsActive = 1");

    if (result.recordset.length === 0) {
      return res.status(401).json({ msg: "Usuario no existe" });
    }

    const user = result.recordset[0];

    const valid = await bcrypt.compare(password, user.Password);
    if (!valid) return res.status(401).json({ msg: "Password incorrecto" });

    // Obtener empresas del usuario
    const companiesResult = await pool.request()
      .input("User_Id", sql.Int, user.User_Id)
      .query("SELECT Company_Id FROM ERP_USERCOMPANIES WHERE User_Id = @User_Id");
    
    const userCompanies = companiesResult.recordset.map(c => c.Company_Id);

    const token = jwt.sign(
      { 
        id: user.User_Id, 
        rol: user.RolId,
        companies: userCompanies
      },
      "ERP_SECRET_KEY",
      { expiresIn: "8h" }
    );
    // Update user's last login first (separate query for clarity/reliability)
    let sessionId = null;
    try {
      await pool.request()
        .input("User_Id", sql.Int, user.User_Id)
        .query('UPDATE ERP_USERS SET LastLogin = GETDATE() WHERE User_Id = @User_Id');

      // attempt to insert session record; if it fails we still continue
      try {
        const insert = await pool.request()
          .input("User_Id", sql.Int, user.User_Id)
          .input("Token", sql.VarChar, token)
          .query('INSERT INTO ERP_USER_SESSIONS (User_Id, LoginTime, Token) VALUES (@User_Id, GETDATE(), @Token); SELECT SCOPE_IDENTITY() AS Session_Id;');
        sessionId = insert.recordset && insert.recordset.length > 0 ? insert.recordset[0].Session_Id : null;
      } catch (sessErr) {
        console.error('Session insert error:', sessErr);
      }

      // reload user to include updated LastLogin value
      try {
        const refreshed = await pool.request()
          .input('User_Id', sql.Int, user.User_Id)
          .query('SELECT * FROM ERP_USERS WHERE User_Id = @User_Id');
        const freshUser = refreshed.recordset && refreshed.recordset.length > 0 ? refreshed.recordset[0] : user;
        return res.json({ token, user: freshUser, sessionId });
      } catch (refErr) {
        console.error('User refresh error:', refErr);
        return res.json({ token, user, sessionId });
      }
    } catch (innerErr) {
      console.error('LastLogin update error:', innerErr);
      return res.json({ token, user, sessionId });
    }

  } catch (err) {
    console.log("SQL ERROR:", err);
    res.status(500).json({ msg: "Error servidor" });
  }
};

exports.logout = async (req, res) => {
  const { sessionId } = req.body || {};
  const authHeader = req.headers.authorization || req.headers.Authorization;
  const token = authHeader ? authHeader.split(' ')[1] : null;

  try {
    await pool.connect();
    if (sessionId) {
      await pool.request()
        .input('Session_Id', sql.Int, sessionId)
        .query('UPDATE ERP_USER_SESSIONS SET LogoutTime = GETDATE() WHERE Session_Id = @Session_Id AND LogoutTime IS NULL');
      return res.json({ msg: 'Logout registrado' });
    }

    if (token) {
      await pool.request()
        .input('Token', sql.VarChar, token)
        .query('UPDATE ERP_USER_SESSIONS SET LogoutTime = GETDATE() WHERE Token = @Token AND LogoutTime IS NULL');
      return res.json({ msg: 'Logout registrado por token' });
    }

    return res.status(400).json({ msg: 'sessionId o token requerido' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ msg: 'Error registrando logout' });
  }
};
