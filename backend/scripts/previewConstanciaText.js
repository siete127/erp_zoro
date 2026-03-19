const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Uso: node scripts/previewConstanciaText.js <ruta-pdf>');
    process.exit(1);
  }
  const absPath = path.resolve(filePath);
  console.log('Leyendo archivo:', absPath);
  const dataBuffer = fs.readFileSync(absPath);
  const pdfData = await pdfParse(dataBuffer);
  console.log('\n=== TEXTO EXTRAIDO ===');
  const lines = pdfData.text.split('\n');
  lines.forEach((l, idx) => {
    console.log(String(idx + 1).padStart(3, '0') + ': ' + l.replace(/\r/g, ''));
  });
  console.log('=== FIN TEXTO ===');
}

main().catch(err => {
  console.error('Error leyendo PDF:', err);
  process.exit(1);
});
