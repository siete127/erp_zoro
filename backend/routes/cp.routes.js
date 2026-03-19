const express = require('express');
const router = express.Router();
const https = require('https');

// GET /api/cp/:codigo
// Proxy interno — usa la API pública de Icalia Labs / Sepomex (sin token requerido).
router.get('/:codigo', (req, res) => {
  const cp = String(req.params.codigo || '').replace(/\D/g, '');
  if (cp.length !== 5) {
    return res.status(400).json({ success: false, msg: 'Código postal inválido' });
  }

  const url = `https://sepomex.icalialabs.com/api/v1/zip_codes?zip_code=${cp}&per_page=1`;

  https.get(url, { headers: { 'Accept': 'application/json' } }, (upstream) => {
    let body = '';
    upstream.on('data', (chunk) => { body += chunk; });
    upstream.on('end', () => {
      try {
        const json = JSON.parse(body);
        const first = json?.zip_codes?.[0];

        if (!first) {
          return res.status(404).json({ success: false, msg: 'CP no encontrado' });
        }

        return res.json({
          success: true,
          data: {
            ciudad:  first.d_ciudad  || first.d_mnpio  || '',
            municipio: first.d_mnpio || '',
            estado:  first.d_estado  || '',
            colonia: first.d_asenta  || '',
            pais:    'México'
          }
        });
      } catch (e) {
        return res.status(502).json({ success: false, msg: 'Error procesando respuesta' });
      }
    });
  }).on('error', (err) => {
    console.error('cp.routes error:', err.message);
    return res.status(502).json({ success: false, msg: 'No se pudo consultar el servicio de CP' });
  });
});

module.exports = router;
