const fs = require('fs');
const path = require('path');
// database connection utilities (required for company-specific config)
const { pool, sql } = require('../config/db');
const emailService = require('../services/emailService');

// GET /api/config/email-aprobacion
exports.getEmailAprobacion = async (req, res) => {
  try {
    const email = process.env.EMAIL_APROBACION_PRECIOS || '';
    res.json({ email });
  } catch (err) {
    console.error('Error obteniendo email de aprobación', err);
    res.status(500).json({ msg: 'Error al obtener configuración' });
  }
};

// PUT /api/config/email-aprobacion
exports.updateEmailAprobacion = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email || !email.includes('@')) {
      return res.status(400).json({ msg: 'Email inválido' });
    }

    const envPath = path.join(__dirname, '..', '.env');
    let envContent = fs.readFileSync(envPath, 'utf8');

    // Reemplazar o agregar EMAIL_APROBACION_PRECIOS
    const regex = /EMAIL_APROBACION_PRECIOS=.*/;
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `EMAIL_APROBACION_PRECIOS=${email}`);
    } else {
      envContent += `\nEMAIL_APROBACION_PRECIOS=${email}\n`;
    }

    fs.writeFileSync(envPath, envContent, 'utf8');
    
    // Actualizar variable de entorno en memoria
    process.env.EMAIL_APROBACION_PRECIOS = email;

    // enviar correo de prueba al nuevo destino para confirmar
    try {
      await emailService.sendMail({
        to: email,
        subject: 'Correo de aprobación de precios actualizado',
        html: `<p>Este correo ha sido configurado para recibir solicitudes de aprobación de cambios de precio.</p>`
      });
    } catch (err) {
      console.error('Error enviando correo de prueba al nuevo email de aprobación', err);
    }

    res.json({ msg: 'Email de aprobación actualizado', email });
  } catch (err) {
    console.error('Error actualizando email de aprobación', err);
    res.status(500).json({ msg: 'Error al actualizar configuración' });
  }
};

// New endpoints: manage approval emails per company (instead of env var)

// GET /api/config/precio-emails?company_id=1 OR client_id=1
exports.getPriceApprovalEmails = async (req, res) => {
  try {
    let companyId = req.query.company_id;
    const clientId = req.query.client_id;

    // si viene client_id, resolver company_id del cliente usando ERP_CLIENTCOMPANIES
    if (clientId && !companyId) {
      const clientRes = await pool.request()
        .input('Client_Id', sql.Int, Number(clientId))
        .query('SELECT TOP 1 Company_Id FROM ERP_CLIENTCOMPANIES WHERE Client_Id = @Client_Id');
      if (clientRes.recordset && clientRes.recordset[0]) {
        companyId = clientRes.recordset[0].Company_Id;
      }
    }

    // si el usuario no es admin, limitar a sus compañías
    if (!req.isAdmin) {
      const list = req.userCompanies || [];
      if (list.length === 0) return res.json({ email1: '', email2: '' });
      companyId = list[0];
    }
    if (!companyId) {
      return res.status(400).json({ msg: 'company_id o client_id requerido' });
    }
    const r = await pool.request()
      .input('Company_Id', sql.Int, Number(companyId))
      .query('SELECT EmailAprobacion1, EmailAprobacion2 FROM ERP_COMPANY WHERE Company_Id = @Company_Id');
    const row = r.recordset && r.recordset[0] ? r.recordset[0] : { EmailAprobacion1: '', EmailAprobacion2: '' };
    res.json({ email1: row.EmailAprobacion1 || '', email2: row.EmailAprobacion2 || '' });
  } catch (err) {
    console.error('Error obteniendo correos de aprobación por empresa', err);
    res.status(500).json({ msg: 'Error al obtener configuración' });
  }
};

// PUT /api/config/precio-emails
exports.updatePriceApprovalEmails = async (req, res) => {
  try {
    const { company_id, email1, email2 } = req.body;
    let companyId = company_id;
    if (!req.isAdmin) {
      const list = req.userCompanies || [];
      if (list.length === 0) return res.status(403).json({ msg: 'No autorizado' });
      companyId = list[0];
    }
    if (!companyId) return res.status(400).json({ msg: 'company_id requerido' });
    // validar formatos simples
    const checkEmail = (e) => !e || e.includes('@');
    if (!checkEmail(email1) || !checkEmail(email2)) {
      return res.status(400).json({ msg: 'Email inválido' });
    }
    await pool.request()
      .input('Company_Id', sql.Int, Number(companyId))
      .input('EmailAprobacion1', sql.VarChar(250), email1 || null)
      .input('EmailAprobacion2', sql.VarChar(250), email2 || null)
      .query(`
        UPDATE ERP_COMPANY
        SET EmailAprobacion1 = @EmailAprobacion1,
            EmailAprobacion2 = @EmailAprobacion2
        WHERE Company_Id = @Company_Id
      `);
    // avisar por correo a los nuevos destinatarios que fueron configurados
    const notify = async (to) => {
      if (!to) return;
      try {
        await emailService.sendMail({
          to,
          subject: 'Correo de aprobación de precios actualizado',
          html: `<p>Hola,</p>
                 <p>Se te ha configurado como aprobador de cambios de precio para la empresa ${companyId}.</p>
                 <p>Si no deberías recibir estos correos, contacta al administrador.</p>`
        });
      } catch (e) {
        console.error('Error notificando cambio de correo a', to, e);
      }
    };
    await notify(email1);
    await notify(email2);
    res.json({ msg: 'Correos de aprobación actualizados', email1: email1 || '', email2: email2 || '' });
  } catch (err) {
    console.error('Error actualizando correos de aprobación', err);
    res.status(500).json({ msg: 'Error al actualizar configuración' });
  }
};
