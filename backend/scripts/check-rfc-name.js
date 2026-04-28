const axios = require('axios');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
const env = fs.readFileSync(envPath, 'utf8').split('\n').reduce((acc, line) => {
  const [k, ...v] = line.split('=');
  if (k && k.trim()) acc[k.trim()] = v.join('=').trim();
  return acc;
}, {});

const baseURL = env.FACTURAMA_BASE_URL;
const auth = Buffer.from(`${env.FACTURAMA_USER}:${env.FACTURAMA_PASSWORD}`).toString('base64');

(async () => {
  const nombres = [
    'PTC REMA SA DE CV',
    'PTCREMA',
    'PTC REMA S.A. DE C.V.',
    'PTC REMA, S.A. DE C.V.',
  ];

  // Probar con el propio RFC emisor como receptor (RFC real del SAT)
  const payloadAutoFactura = {
    Issuer: { Rfc: 'CALI691111PX9', Name: 'MARIA ISABEL CHAVEZ LOMELI', FiscalRegime: '612' },
    Folio: String(Date.now()).slice(-8),
    CfdiType: 'I', NameId: '1',
    ExpeditionPlace: '55740', PaymentForm: '01', PaymentMethod: 'PUE', Currency: 'MXN',
    Receiver: {
      Rfc: 'CALI691111PX9',
      Name: 'MARIA ISABEL CHAVEZ LOMELI',
      CfdiUse: 'G01',
      FiscalRegime: '612',
      TaxZipCode: '55740'
    },
    Items: [{
      ProductCode: '01010101', UnitCode: 'E48', Unit: 'Pieza',
      Description: 'Prueba', Quantity: 1, UnitPrice: 100,
      Subtotal: 100, TaxObject: '02', Total: 116,
      Taxes: [{ Name: 'IVA', IsRetention: false, Base: 100, Rate: 0.16, Total: 16, Type: 'Federal' }]
    }]
  };

  try {
    const r = await axios.post(`${baseURL}/api-lite/3/cfdis`, payloadAutoFactura, {
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' }
    });
    console.log('EXITO autofactura CALI691111PX9 como receptor');
    console.log('Respuesta:', JSON.stringify(r.data, null, 2));
    process.exit(0);
  } catch (e) {
    const detail = e.response?.data;
    console.log('FALLO autofactura ->', JSON.stringify(detail, null, 2));
  }

  // Probar variantes del nombre original con el RFC PRE2507108S2
  const nombresAlt = [
    'PTC REMA SA DE CV',
    'PTCREMA',
    'PTC REMA S.A. DE C.V.',
    'PTC REMA, S.A. DE C.V.',
  ];

  for (const nombre of nombresAlt) {
    const payload = {
      Issuer: { Rfc: 'CALI691111PX9', Name: 'MARIA ISABEL CHAVEZ LOMELI', FiscalRegime: '612' },
      Folio: String(Date.now()).slice(-8),
      CfdiType: 'I', NameId: '1',
      ExpeditionPlace: '55740', PaymentForm: '01', PaymentMethod: 'PUE', Currency: 'MXN',
      Receiver: {
        Rfc: 'PRE2507108S2',
        Name: nombre,
        CfdiUse: 'G01',
        FiscalRegime: '601',
        TaxZipCode: '55680'
      },
      Items: [{
        ProductCode: '01010101', UnitCode: 'E48', Unit: 'Pieza',
        Description: 'Prueba', Quantity: 1, UnitPrice: 100,
        Subtotal: 100, TaxObject: '02', Total: 116,
        Taxes: [{ Name: 'IVA', IsRetention: false, Base: 100, Rate: 0.16, Total: 16, Type: 'Federal' }]
      }]
    };

    try {
      const r = await axios.post(`${baseURL}/api-lite/3/cfdis`, payload, {
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' }
      });
      console.log(`EXITO con nombre: "${nombre}"`);
      console.log('Respuesta:', JSON.stringify(r.data, null, 2));
      process.exit(0);
    } catch (e) {
      const msg = e.response?.data?.Message || JSON.stringify(e.response?.data) || e.message;
      console.log(`FALLO "${nombre}" -> ${msg}`);
    }
  }
  process.exit(1);
})();

