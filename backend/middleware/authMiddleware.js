const jwt = require('jsonwebtoken');
const { pool, sql } = require('../config/db');
const { getJwtSecret } = require('../config/env');

const jwtSecret = getJwtSecret();

// Middleware to validate JWT, load user and ensure user is active
module.exports = async function (req, res, next) {
	try {
		const authHeader = req.headers.authorization || req.headers.Authorization;
		if (!authHeader) return res.status(401).json({ msg: 'No autorizado (token faltante)' });

		const token = authHeader.split(' ')[1];
		if (!token) return res.status(401).json({ msg: 'No autorizado (token inválido)' });

		let payload;
		try {
			payload = jwt.verify(token, jwtSecret);
		} catch (err) {
			return res.status(401).json({ msg: 'Token inválido' });
		}

		const userId = payload.id;
		if (!userId) return res.status(401).json({ msg: 'Token inválido' });

		await pool.connect();
		const result = await pool.request()
			.input('User_Id', sql.Int, userId)
			.query('SELECT * FROM ERP_USERS WHERE User_Id = @User_Id');

		if (!result.recordset || result.recordset.length === 0) {
			return res.status(401).json({ msg: 'Usuario no encontrado' });
		}

		const user = result.recordset[0];
		if (!user.IsActive || Number(user.IsActive) !== 1) {
			return res.status(403).json({ msg: 'Usuario desactivado' });
		}

		// Obtener empresas del usuario
		const companiesResult = await pool.request()
			.input('User_Id', sql.Int, userId)
			.query('SELECT Company_Id FROM ERP_USERCOMPANIES WHERE User_Id = @User_Id');
		
		const userCompanies = companiesResult.recordset.map(c => c.Company_Id);

		// attach user and companies to request for downstream handlers
		req.user = user;
		req.userCompanies = userCompanies;
		req.isSuperAdmin = user.RolId === 1; // Asumiendo que RolId 1 es superadmin
		req.isAdmin = user.RolId === 1 || user.RolId === 2; // RolId 1 o 2 son admin
		next();
	} catch (err) {
		console.error('Auth middleware error:', err);
		return res.status(500).json({ msg: 'Error de autenticación' });
	}
};
