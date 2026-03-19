const { pool, sql } = require('../config/db');
const emailService = require('../services/emailService');

// Obtener precios personalizados de un cliente
exports.getClientPrices = async (req, res) => {
  try {
    const { clientId } = req.params;
    await pool.connect();
    
    const result = await pool.request()
      .input('Client_Id', sql.Int, clientId)
      .query(`
        SELECT 
          p.Producto_Id as Product_Id,
          p.Nombre as ProductName,
          p.Precio as BasePrice,
          cp.PrecioPersonalizado as CustomPrice,
          cp.Activo as IsActive,
          cp.FechaActualizacion as UpdatedAt
        FROM ERP_PRODUCTOS p
        LEFT JOIN ERP_PRECIOS_CLIENTE_PRODUCTO cp ON cp.Producto_Id = p.Producto_Id AND cp.Cliente_Id = @Client_Id
        WHERE p.Activo = 1
        ORDER BY p.Nombre
      `);
    
    res.json({ success: true, data: result.recordset });
  } catch (error) {
    console.error('Error al obtener precios:', error);
    res.status(500).json({ success: false, message: 'Error al obtener precios' });
  }
};

// Crear solicitud de cambio de precio para múltiples productos
exports.createMultiPriceChangeRequest = async (req, res) => {
  try {
    const { clientId, products, approver1Email, approver2Email, reason, saleId } = req.body;
    const userId = req.user?.User_Id || req.user?.id;
    
    if (!products || products.length === 0) {
      return res.status(400).json({ success: false, message: 'Debe incluir al menos un producto' });
    }
    
    await pool.connect();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    
    try {
      // Crear solicitud principal
      const requestResult = await transaction.request()
        .input('Client_Id', sql.Int, clientId)
        .input('RequestedBy', sql.Int, userId)
        .input('Approver1_Email', sql.VarChar, approver1Email)
        .input('Approver2_Email', sql.VarChar, approver2Email)
        .input('Reason', sql.VarChar, reason)
        .input('Sale_Id', sql.Int, saleId || null)
        .input('Status', sql.VarChar, 'pending')
        .query(`
          INSERT INTO ERP_SOLICITUDES_CAMBIO_PRECIO 
          (Cliente_Id, SolicitadoPor, EmailAprobador1, EmailAprobador2, Razon, Venta_Id, Estado, EstadoAprobador1, EstadoAprobador2)
          OUTPUT INSERTED.Solicitud_Id
          VALUES (@Client_Id, @RequestedBy, @Approver1_Email, @Approver2_Email, @Reason, @Sale_Id, @Status, 'pending', 'pending')
        `);
      
      const requestId = requestResult.recordset[0].Solicitud_Id;
      
      // Insertar detalles de productos
      for (const product of products) {
        await transaction.request()
          .input('Request_Id', sql.Int, requestId)
          .input('Product_Id', sql.Int, product.productId)
          .input('CurrentPrice', sql.Decimal(18, 2), product.currentPrice || null)
          .input('NewPrice', sql.Decimal(18, 2), product.newPrice)
          .query(`
            INSERT INTO ERP_SOLICITUD_PRECIO_DETALLE 
            (Solicitud_Id, Producto_Id, PrecioActual, PrecioNuevo)
            VALUES (@Request_Id, @Product_Id, @CurrentPrice, @NewPrice)
          `);
      }
      
      await transaction.commit();
      
      // Obtener información para el email
      const detailsResult = await pool.request()
        .input('Client_Id', sql.Int, clientId)
        .query('SELECT LegalName as ClientName FROM ERP_CLIENT WHERE Client_Id = @Client_Id');
      
      const clientName = detailsResult.recordset[0]?.ClientName || 'Cliente';
      
      // Obtener nombres de productos
      const productsWithNames = await Promise.all(
        products.map(async (product) => {
          const productResult = await pool.request()
            .input('Product_Id', sql.Int, product.productId)
            .query('SELECT Nombre FROM ERP_PRODUCTOS WHERE Producto_Id = @Product_Id');
          
          return {
            ...product,
            productName: productResult.recordset[0]?.Nombre || `Producto ${product.productId}`
          };
        })
      );
      
      // Enviar emails de aprobación
      await sendMultiProductApprovalEmails(requestId, approver1Email, approver2Email, clientName, productsWithNames);
      
      res.json({ success: true, message: 'Solicitud creada. Esperando aprobaciones.', requestId });
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    console.error('Error al crear solicitud múltiple:', error);
    res.status(500).json({ success: false, message: 'Error al crear solicitud' });
  }
};

// Crear solicitud de cambio de precio (requiere doble aprobación)
exports.createPriceChangeRequest = async (req, res) => {
  try {
    const { clientId, productId, newPrice, approver1Email, approver2Email, reason, saleId } = req.body;
    const userId = req.user?.User_Id || req.user?.id;
    
    await pool.connect();
    
    // Obtener precio actual
    const currentPriceResult = await pool.request()
      .input('Client_Id', sql.Int, clientId)
      .input('Product_Id', sql.Int, productId)
      .query('SELECT PrecioPersonalizado as CustomPrice FROM ERP_PRECIOS_CLIENTE_PRODUCTO WHERE Cliente_Id = @Client_Id AND Producto_Id = @Product_Id');
    
    const currentPrice = currentPriceResult.recordset[0]?.CustomPrice || null;
    
    // Crear solicitud
    const result = await pool.request()
      .input('Client_Id', sql.Int, clientId)
      .input('Product_Id', sql.Int, productId)
      .input('CurrentPrice', sql.Decimal(18, 2), currentPrice)
      .input('NewPrice', sql.Decimal(18, 2), newPrice)
      .input('RequestedBy', sql.Int, userId)
      .input('Approver1_Email', sql.VarChar, approver1Email)
      .input('Approver2_Email', sql.VarChar, approver2Email)
      .input('Reason', sql.VarChar, reason)
      .input('Sale_Id', sql.Int, saleId || null)
      .query(`
        INSERT INTO ERP_SOLICITUDES_CAMBIO_PRECIO 
        (Cliente_Id, Producto_Id, PrecioActual, PrecioNuevo, SolicitadoPor, EmailAprobador1, EmailAprobador2, Razon, Venta_Id)
        OUTPUT INSERTED.Solicitud_Id
        VALUES (@Client_Id, @Product_Id, @CurrentPrice, @NewPrice, @RequestedBy, @Approver1_Email, @Approver2_Email, @Reason, @Sale_Id)
      `);
    
    const requestId = result.recordset[0].Solicitud_Id;
    
    // Obtener nombres de cliente y producto para el email
    const detailsResult = await pool.request()
      .input('Client_Id', sql.Int, clientId)
      .input('Product_Id', sql.Int, productId)
      .query(`
        SELECT c.LegalName as ClientName, p.Nombre as ProductName
        FROM ERP_CLIENT c, ERP_PRODUCTOS p
        WHERE c.Client_Id = @Client_Id AND p.Producto_Id = @Product_Id
      `);
    
    const { ClientName, ProductName } = detailsResult.recordset[0];
    
    // Enviar emails de aprobación
    await sendApprovalEmails(requestId, approver1Email, approver2Email, ClientName, ProductName, newPrice);
    
    res.json({ success: true, message: 'Solicitud creada. Esperando aprobaciones.', requestId });
  } catch (error) {
    console.error('Error al crear solicitud:', error);
    res.status(500).json({ success: false, message: 'Error al crear solicitud' });
  }
};

// Aprobar/Rechazar solicitud
exports.approvePriceChange = async (req, res) => {
  try {
    console.log('=== APPROVE PRICE CHANGE ===');
    console.log('Method:', req.method);
    console.log('Query params:', req.query);
    console.log('Body:', req.body);

    const { requestId } = req.params;
    const { approverEmail, action } = req.method === 'GET' ? req.query : req.body;

    if (!approverEmail || !action) {
      return res.status(400).send(`
        <html><body style="font-family:Arial;text-align:center;padding:40px">
        <h2>Parámetros faltantes</h2>
        <p>approverEmail: ${approverEmail || 'MISSING'} | action: ${action || 'MISSING'}</p>
        </body></html>
      `);
    }

    // Doble decode por si el email viene doble-encoded en la URL
    let decodedEmail;
    try {
      decodedEmail = decodeURIComponent(decodeURIComponent(approverEmail));
    } catch (e) {
      decodedEmail = decodeURIComponent(approverEmail);
    }

    // Normalizar: minúsculas, sin espacios ni caracteres invisibles
    const normalizedEmail = decodedEmail.toLowerCase().trim().replace(/\s+/g, '');

    console.log('EMAIL RAW:', approverEmail);
    console.log('EMAIL DECODED:', decodedEmail);
    console.log('EMAIL NORMALIZED:', normalizedEmail);

    await pool.connect();

    const requestResult = await pool.request()
      .input('Request_Id', sql.Int, requestId)
      .query(`
        SELECT 
          Solicitud_Id,
          Cliente_Id,
          SolicitadoPor,
          EmailAprobador1,
          EmailAprobador2,
          EstadoAprobador1,
          EstadoAprobador2,
          Estado
        FROM ERP_SOLICITUDES_CAMBIO_PRECIO
        WHERE Solicitud_Id = @Request_Id
      `);

    if (requestResult.recordset.length === 0) {
      return res.status(404).send(`
        <html><body style="font-family:Arial;text-align:center;padding:40px">
        <h2>Solicitud no encontrada</h2>
        </body></html>
      `);
    }

    const request = requestResult.recordset[0];

    if (request.Estado === 'completed' || request.Estado === 'rejected') {
      return res.send(`
        <html><body style="font-family:Arial;text-align:center;padding:40px">
        <h2>⚠️ Esta solicitud ya fue procesada</h2>
        <p>Estado: ${request.Estado}</p>
        </body></html>
      `);
    }

    // Normalizar emails de la BD (eliminar espacios invisibles, saltos de línea, etc.)
    const email1 = (request.EmailAprobador1 || '').toLowerCase().trim().replace(/\s+/g, '');
    const email2 = (request.EmailAprobador2 || '').toLowerCase().trim().replace(/\s+/g, '');

    console.log('EMAIL QUE APRUEBA:', normalizedEmail);
    console.log('EMAIL APROBADOR 1:', email1);
    console.log('EMAIL APROBADOR 2:', email2);
    console.log('¿Coincide con email1?', normalizedEmail === email1);
    console.log('¿Coincide con email2?', normalizedEmail === email2);

    const status = action === 'approve' ? 'approved' : 'rejected';
    let approverNumber = null;

    if (normalizedEmail === email1) {
      console.log('APROBADOR 1 detectado');
      approverNumber = 1;

      await pool.request()
        .input('Request_Id', sql.Int, requestId)
        .input('Status', sql.VarChar, status)
        .query(`
          UPDATE ERP_SOLICITUDES_CAMBIO_PRECIO
          SET EstadoAprobador1 = @Status,
              FechaAprobador1 = GETDATE()
          WHERE Solicitud_Id = @Request_Id
        `);

    } else if (normalizedEmail === email2) {
      console.log('APROBADOR 2 detectado');
      approverNumber = 2;

      await pool.request()
        .input('Request_Id', sql.Int, requestId)
        .input('Status', sql.VarChar, status)
        .query(`
          UPDATE ERP_SOLICITUDES_CAMBIO_PRECIO
          SET EstadoAprobador2 = @Status,
              FechaAprobador2 = GETDATE()
          WHERE Solicitud_Id = @Request_Id
        `);

    } else {
      console.log('EMAIL NO AUTORIZADO');
      console.log('Chars email recibido:', [...normalizedEmail].map(c => c.charCodeAt(0)));
      console.log('Chars email1 en BD:  ', [...email1].map(c => c.charCodeAt(0)));
      console.log('Chars email2 en BD:  ', [...email2].map(c => c.charCodeAt(0)));

      return res.status(403).send(`
        <html><body style="font-family:Arial;text-align:center;padding:40px">
        <h2>🚫 No autorizado</h2>
        <p>El email <strong>${decodedEmail}</strong> no está autorizado para esta solicitud.</p>
        </body></html>
      `);
    }

    // Leer estado actualizado tras el UPDATE
    const updatedResult = await pool.request()
      .input('Request_Id', sql.Int, requestId)
      .query(`
        SELECT 
          EstadoAprobador1,
          EstadoAprobador2,
          Estado,
          Cliente_Id,
          SolicitadoPor
        FROM ERP_SOLICITUDES_CAMBIO_PRECIO
        WHERE Solicitud_Id = @Request_Id
      `);

    const req2 = updatedResult.recordset[0];

    console.log('Estado tras update:', {
      EstadoAprobador1: req2.EstadoAprobador1,
      EstadoAprobador2: req2.EstadoAprobador2,
      Estado: req2.Estado
    });

    const io = req.app.get('io');

    // Emitir evento WebSocket con estado actual
    if (io) {
      io.emit('priceRequestUpdate', {
        requestId: requestId,
        approver1Status: req2.EstadoAprobador1,
        approver2Status: req2.EstadoAprobador2,
        status: req2.Estado
      });
    }

    // ── CASO: Alguno rechazó ──────────────────────────────────────────
    if (req2.EstadoAprobador1 === 'rejected' || req2.EstadoAprobador2 === 'rejected') {
      await pool.request()
        .input('Request_Id', sql.Int, requestId)
        .query(`
          UPDATE ERP_SOLICITUDES_CAMBIO_PRECIO
          SET Estado = 'rejected',
              FechaCompletado = GETDATE()
          WHERE Solicitud_Id = @Request_Id
        `);

      if (io) {
        io.emit('priceRequestUpdate', {
          requestId: requestId,
          approver1Status: req2.EstadoAprobador1,
          approver2Status: req2.EstadoAprobador2,
          status: 'rejected'
        });
      }

      return res.send(`
        <html><body style="font-family:Arial;text-align:center;padding:40px">
        <h1 style="color:#ef4444;">✗ Solicitud Rechazada</h1>
        <p>La solicitud #${requestId} ha sido rechazada.</p>
        </body></html>
      `);
    }

    // ── CASO: Ambos aprobaron → aplicar cambios de precio ────────────
    if (req2.EstadoAprobador1 === 'approved' && req2.EstadoAprobador2 === 'approved') {
      const transaction = new sql.Transaction(pool);
      await transaction.begin();

      try {
        const detailsResult = await transaction.request()
          .input('Request_Id', sql.Int, requestId)
          .query(`
            SELECT Producto_Id, PrecioNuevo
            FROM ERP_SOLICITUD_PRECIO_DETALLE
            WHERE Solicitud_Id = @Request_Id
          `);

        for (const detail of detailsResult.recordset) {
          const exists = await transaction.request()
            .input('Client_Id', sql.Int, req2.Cliente_Id)
            .input('Product_Id', sql.Int, detail.Producto_Id)
            .query(`
              SELECT 1
              FROM ERP_PRECIOS_CLIENTE_PRODUCTO
              WHERE Cliente_Id = @Client_Id AND Producto_Id = @Product_Id
            `);

          if (exists.recordset.length > 0) {
            await transaction.request()
              .input('Client_Id', sql.Int, req2.Cliente_Id)
              .input('Product_Id', sql.Int, detail.Producto_Id)
              .input('NewPrice', sql.Decimal(18, 2), detail.PrecioNuevo)
              .query(`
                UPDATE ERP_PRECIOS_CLIENTE_PRODUCTO
                SET PrecioPersonalizado = @NewPrice,
                    FechaActualizacion = GETDATE()
                WHERE Cliente_Id = @Client_Id AND Producto_Id = @Product_Id
              `);
          } else {
            await transaction.request()
              .input('Client_Id', sql.Int, req2.Cliente_Id)
              .input('Product_Id', sql.Int, detail.Producto_Id)
              .input('NewPrice', sql.Decimal(18, 2), detail.PrecioNuevo)
              .input('CreatedBy', sql.Int, req2.SolicitadoPor)
              .query(`
                INSERT INTO ERP_PRECIOS_CLIENTE_PRODUCTO
                (Cliente_Id, Producto_Id, PrecioPersonalizado, CreadoPor)
                VALUES (@Client_Id, @Product_Id, @NewPrice, @CreatedBy)
              `);
          }
        }

        await transaction.request()
          .input('Request_Id', sql.Int, requestId)
          .query(`
            UPDATE ERP_SOLICITUDES_CAMBIO_PRECIO
            SET Estado = 'completed',
                FechaCompletado = GETDATE()
            WHERE Solicitud_Id = @Request_Id
          `);

        await transaction.commit();

        if (io) {
          io.emit('priceRequestUpdate', {
            requestId: requestId,
            approver1Status: 'approved',
            approver2Status: 'approved',
            status: 'completed'
          });
        }

        return res.send(`
          <html><body style="font-family:Arial;text-align:center;padding:40px">
          <h1 style="color:#10b981;">✓ Precios Actualizados</h1>
          <p>Todos los cambios de precio han sido aplicados correctamente.</p>
          </body></html>
        `);

      } catch (err) {
        await transaction.rollback();
        throw err;
      }
    }

    // ── CASO: Solo uno aprobó, esperando el otro ──────────────────────
    return res.send(`
      <html><body style="font-family:Arial;text-align:center;padding:40px">
      <h1 style="color:#3b82f6;">✓ Aprobación registrada</h1>
      <p>Aprobador ${approverNumber} ha ${action === 'approve' ? 'aprobado' : 'rechazado'} la solicitud.</p>
      <p>Esperando la segunda aprobación...</p>
      </body></html>
    `);

  } catch (error) {
    console.error('Error al aprobar solicitud:', error);
    return res.status(500).send(`
      <html><body style="font-family:Arial;text-align:center;padding:40px">
      <h2>Error al procesar la solicitud</h2>
      <p>${error.message}</p>
      </body></html>
    `);
  }
};

// Obtener estado actual de una solicitud de cambio de precio
exports.getPriceRequestStatus = async (req, res) => {
  try {
    const { requestId } = req.params;
    
    await pool.connect();
    
    const result = await pool.request()
      .input('Request_Id', sql.Int, requestId)
      .query('SELECT Solicitud_Id as Request_Id, EstadoAprobador1 as Approver1_Status, EstadoAprobador2 as Approver2_Status, Estado as Status FROM ERP_SOLICITUDES_CAMBIO_PRECIO WHERE Solicitud_Id = @Request_Id');
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ success: false, message: 'Solicitud no encontrada' });
    }
    
    const solicitud = result.recordset[0];
    
    const io = req.app.get('io');
    if (io) {
      console.log('📡 Emitiendo priceRequestUpdate (desde getPriceRequestStatus):', {
        requestId: requestId,
        approver1Status: solicitud.Approver1_Status,
        approver2Status: solicitud.Approver2_Status,
        status: solicitud.Status
      });
      io.emit('priceRequestUpdate', {
        requestId: requestId,
        approver1Status: solicitud.Approver1_Status,
        approver2Status: solicitud.Approver2_Status,
        status: solicitud.Status
      });
    }
    
    res.json({
      success: true,
      data: {
        requestId: solicitud.Request_Id,
        approver1Status: solicitud.Approver1_Status,
        approver2Status: solicitud.Approver2_Status,
        status: solicitud.Status
      }
    });
  } catch (error) {
    console.error('Error al obtener estado de solicitud:', error);
    res.status(500).json({ success: false, message: 'Error al obtener estado' });
  }
};

// Obtener solicitudes pendientes
exports.getPendingRequests = async (req, res) => {
  try {
    await pool.connect();
    
    const result = await pool.request()
      .query(`
        SELECT 
          r.Solicitud_Id as Request_Id,
          c.LegalName as ClientName,
          p.Nombre as ProductName,
          r.PrecioActual as CurrentPrice,
          r.PrecioNuevo as NewPrice,
          r.EmailAprobador1 as Approver1_Email,
          r.EmailAprobador2 as Approver2_Email,
          r.EstadoAprobador1 as Approver1_Status,
          r.EstadoAprobador2 as Approver2_Status,
          r.Estado as Status,
          r.Razon as Reason,
          r.FechaCreacion as CreatedAt,
          u.Name as RequestedByName
        FROM ERP_SOLICITUDES_CAMBIO_PRECIO r
        INNER JOIN ERP_CLIENT c ON c.Client_Id = r.Cliente_Id
        INNER JOIN ERP_PRODUCTOS p ON p.Producto_Id = r.Producto_Id
        INNER JOIN ERP_USERS u ON u.User_Id = r.SolicitadoPor
        WHERE r.Estado = 'pending'
        ORDER BY r.FechaCreacion DESC
      `);
    
    res.json({ success: true, data: result.recordset });
  } catch (error) {
    console.error('Error al obtener solicitudes:', error);
    res.status(500).json({ success: false, message: 'Error al obtener solicitudes' });
  }
};

// Verificar si hay solicitudes pendientes para una venta
exports.checkSalePendingRequests = async (req, res) => {
  try {
    const { saleId } = req.params;
    await pool.connect();
    
    const result = await pool.request()
      .input('Sale_Id', sql.Int, saleId)
      .query(`
        SELECT 
          Solicitud_Id as Request_Id,
          Producto_Id as Product_Id,
          PrecioNuevo as NewPrice,
          EstadoAprobador1 as Approver1_Status,
          EstadoAprobador2 as Approver2_Status,
          Estado as Status
        FROM ERP_SOLICITUDES_CAMBIO_PRECIO
        WHERE Venta_Id = @Sale_Id AND Estado = 'pending'
      `);
    
    const hasPending = result.recordset.length > 0;
    res.json({ success: true, hasPending, requests: result.recordset });
  } catch (error) {
    console.error('Error al verificar solicitudes:', error);
    res.status(500).json({ success: false, message: 'Error al verificar solicitudes' });
  }
};

function getPublicBackendUrl() {
  const candidates = [
    process.env.BACKEND_URL,
    process.env.PUBLIC_BACKEND_URL,
    process.env.FRONTEND_URL,
    'https://qaerp.ardabytec.vip'
  ];

  const selected = candidates.find((value) => typeof value === 'string' && value.trim().length > 0);
  return selected.replace(/\/+$/, '');
}

// Función auxiliar para enviar emails (solicitud de un solo producto)
async function sendApprovalEmails(requestId, email1, email2, clientName, productName, newPrice) {
  const backendUrl = getPublicBackendUrl();
  const approvalLinkApprove1 = `${backendUrl}/api/client-pricing/price-change-request/${requestId}/approve?approverEmail=${encodeURIComponent(email1)}&action=approve`;
  const approvalLinkReject1  = `${backendUrl}/api/client-pricing/price-change-request/${requestId}/approve?approverEmail=${encodeURIComponent(email1)}&action=reject`;
  const approvalLinkApprove2 = `${backendUrl}/api/client-pricing/price-change-request/${requestId}/approve?approverEmail=${encodeURIComponent(email2)}&action=approve`;
  const approvalLinkReject2  = `${backendUrl}/api/client-pricing/price-change-request/${requestId}/approve?approverEmail=${encodeURIComponent(email2)}&action=reject`;

  const buildHtml = (approveLink, rejectLink) => `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
          .container { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px; }
          .content { background: white; padding: 30px; border-radius: 8px; }
          .button { display: inline-block; padding: 12px 30px; color: white; text-decoration: none; border-radius: 5px; margin: 10px 5px; font-weight: bold; }
          .approve { background: #10b981; }
          .reject { background: #ef4444; }
          .info-box { background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="content">
            <h2 style="color: #667eea;">🔔 Solicitud de Aprobación - Cambio de Precio</h2>
            <p>Se ha solicitado un cambio de precio que requiere su aprobación.</p>
            <div class="info-box">
              <p><strong>Cliente:</strong> ${clientName}</p>
              <p><strong>Producto:</strong> ${productName}</p>
              <p><strong>Nuevo Precio:</strong> <span style="color: #10b981; font-size: 18px; font-weight: bold;">$${newPrice}</span></p>
            </div>
            <p><strong>⚠️ Importante:</strong> Se requiere la aprobación de 2 personas para aplicar este cambio.</p>
            <div style="text-align: center;">
              <a href="${approveLink}" class="button approve">✓ Aprobar</a>
              <a href="${rejectLink}" class="button reject">✗ Rechazar</a>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    await emailService.sendMail({
      to: email1,
      subject: 'Solicitud de Aprobación - Cambio de Precio',
      html: buildHtml(approvalLinkApprove1, approvalLinkReject1)
    });
    await emailService.sendMail({
      to: email2,
      subject: 'Solicitud de Aprobación - Cambio de Precio',
      html: buildHtml(approvalLinkApprove2, approvalLinkReject2)
    });
  } catch (error) {
    console.error('Error al enviar emails:', error);
  }
}

// Función auxiliar para enviar emails de solicitudes múltiples
async function sendMultiProductApprovalEmails(requestId, email1, email2, clientName, products) {
  const backendUrl = getPublicBackendUrl();
  const approvalLinkApprove1 = `${backendUrl}/api/client-pricing/price-change-request/${requestId}/approve?approverEmail=${encodeURIComponent(email1)}&action=approve`;
  const approvalLinkReject1  = `${backendUrl}/api/client-pricing/price-change-request/${requestId}/approve?approverEmail=${encodeURIComponent(email1)}&action=reject`;
  const approvalLinkApprove2 = `${backendUrl}/api/client-pricing/price-change-request/${requestId}/approve?approverEmail=${encodeURIComponent(email2)}&action=approve`;
  const approvalLinkReject2  = `${backendUrl}/api/client-pricing/price-change-request/${requestId}/approve?approverEmail=${encodeURIComponent(email2)}&action=reject`;

  const productRows = products.map(p => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 12px; text-align: left;">${p.productName || 'Producto'}</td>
      <td style="padding: 12px; text-align: center; color: #666;">$${parseFloat(p.currentPrice || 0).toFixed(2)}</td>
      <td style="padding: 12px; text-align: center; color: #059669; font-weight: bold;">$${parseFloat(p.newPrice).toFixed(2)}</td>
      <td style="padding: 12px; text-align: center; color: ${p.newPrice > p.currentPrice ? '#dc2626' : '#059669'}; font-weight: bold;">
        ${p.newPrice > p.currentPrice ? '+' : ''}${((p.newPrice - (p.currentPrice || 0)) / (p.currentPrice || 1) * 100).toFixed(1)}%
      </td>
    </tr>
  `).join('');

  const buildHtml = (approveLink, rejectLink) => `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 700px; margin: 0 auto; }
          .container { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px; }
          .content { background: white; padding: 30px; border-radius: 8px; }
          .button { display: inline-block; padding: 12px 30px; color: white; text-decoration: none; border-radius: 5px; margin: 10px 5px; font-weight: bold; }
          .approve { background: #10b981; }
          .reject { background: #ef4444; }
          .info-box { background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .products-table { width: 100%; border-collapse: collapse; margin: 20px 0; background: white; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
          .products-table thead { background: #f3f4f6; }
          .products-table th { padding: 15px; text-align: left; font-weight: bold; color: #374151; border-bottom: 2px solid #e5e7eb; }
          .products-table td { padding: 12px 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="content">
            <h2 style="color: #667eea;">🔔 Solicitud de Aprobación - Cambios de Precio</h2>
            <p>Se ha solicitado un cambio de precio para múltiples productos que requiere su aprobación.</p>
            <div class="info-box">
              <p><strong>Cliente:</strong> ${clientName}</p>
              <p><strong>Productos:</strong> <span style="color: #667eea; font-size: 18px; font-weight: bold;">${products.length} productos</span></p>
            </div>
            <h3 style="color: #374151; margin-top: 25px;">Detalle de Cambios de Precio:</h3>
            <table class="products-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th style="text-align: center;">Precio Actual</th>
                  <th style="text-align: center;">Precio Nuevo</th>
                  <th style="text-align: center;">Cambio</th>
                </tr>
              </thead>
              <tbody>
                ${productRows}
              </tbody>
            </table>
            <p><strong style="color: #dc2626;">⚠️ Importante:</strong> Se requiere la aprobación de 2 personas para aplicar estos cambios.</p>
            <div style="text-align: center; margin-top: 30px;">
              <a href="${approveLink}" class="button approve">✓ Aprobar</a>
              <a href="${rejectLink}" class="button reject">✗ Rechazar</a>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    await emailService.sendMail({
      to: email1,
      subject: `Solicitud de Aprobación - Cambios de Precio (${products.length} productos)`,
      html: buildHtml(approvalLinkApprove1, approvalLinkReject1)
    });
    await emailService.sendMail({
      to: email2,
      subject: `Solicitud de Aprobación - Cambios de Precio (${products.length} productos)`,
      html: buildHtml(approvalLinkApprove2, approvalLinkReject2)
    });
  } catch (error) {
    console.error('Error al enviar emails:', error);
  }
}

module.exports = exports;