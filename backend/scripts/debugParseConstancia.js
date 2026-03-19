const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const { _extractFromPDF } = require('../controllers/constanciaController');

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Uso: node scripts/debugParseConstancia.js <ruta-pdf>');
    process.exit(1);
  }
  const absPath = path.resolve(filePath);
  console.log('Leyendo archivo:', absPath);
  const dataBuffer = fs.readFileSync(absPath);
  const pdfData = await pdfParse(dataBuffer);
  const parsed = _extractFromPDF(pdfData.text);
  console.log('\n=== OBJETO PARSEADO ===');
  console.dir(parsed, { depth: null });
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
