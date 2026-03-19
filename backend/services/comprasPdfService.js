/**
 * comprasPdfService.js
 * Genera PDF de Orden de Compra usando PDFKit
 */
const PDFDocument = require('pdfkit');

/**
 * @param {object} orden  - Orden de compra con detalles
 * @returns {Promise<Buffer>}
 */
exports.generarPDFOrdenCompra = function (orden) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      const detalle = orden.detalle || [];
      const fmt = (n) => `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-MX') : '—';

      /* ── Header ─────────────────────────────────── */
      doc.fontSize(20).font('Helvetica-Bold').fillColor('#1a3c5e')
         .text('ORDEN DE COMPRA', { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(12).font('Helvetica').fillColor('#333')
         .text(`No. ${orden.NumeroOC}`, { align: 'center' });
      doc.moveDown(0.5);

      /* ── Línea separadora ─────────────────────────── */
      doc.moveTo(50, doc.y).lineTo(545, doc.y).lineWidth(1.5).strokeColor('#1a3c5e').stroke();
      doc.moveDown(0.5);

      /* ── Datos empresa / proveedor ─────────────────── */
      const leftX = 50;
      const rightX = 310;
      const topY = doc.y;

      doc.font('Helvetica-Bold').fontSize(9).fillColor('#555').text('EMPRESA:', leftX, topY);
      doc.font('Helvetica').fontSize(10).fillColor('#000').text(orden.Empresa || '—', leftX, topY + 12);
      doc.font('Helvetica').fontSize(9).fillColor('#555').text(`RFC: ${orden.EmpresaRFC || '—'}`, leftX, topY + 24);

      doc.font('Helvetica-Bold').fontSize(9).fillColor('#555').text('PROVEEDOR:', rightX, topY);
      doc.font('Helvetica').fontSize(10).fillColor('#000').text(orden.Proveedor || '—', rightX, topY + 12);
      doc.font('Helvetica').fontSize(9).fillColor('#555').text(`RFC: ${orden.ProveedorRFC || '—'}`, rightX, topY + 24);
      if (orden.ProveedorEmail) {
        doc.text(`Email: ${orden.ProveedorEmail}`, rightX, topY + 36);
      }

      doc.moveDown(4);

      /* ── Info OC ──────────────────────────────────── */
      const infoY = doc.y;
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#555').text('FECHA OC:', leftX, infoY);
      doc.font('Helvetica').fontSize(9).fillColor('#000').text(fmtDate(orden.FechaOC), leftX + 80, infoY);

      doc.font('Helvetica-Bold').fontSize(9).text('FECHA REQUERIDA:', leftX, infoY + 14);
      doc.font('Helvetica').fontSize(9).text(fmtDate(orden.FechaRequerida), leftX + 110, infoY + 14);

      doc.font('Helvetica-Bold').fontSize(9).text('MONEDA:', leftX, infoY + 28);
      doc.font('Helvetica').fontSize(9).text(orden.Moneda || 'MXN', leftX + 65, infoY + 28);

      doc.font('Helvetica-Bold').fontSize(9).text('ESTATUS:', rightX, infoY);
      doc.font('Helvetica').fontSize(9).fillColor('#1a3c5e').text(orden.Estatus || '—', rightX + 70, infoY);

      doc.font('Helvetica-Bold').fontSize(9).fillColor('#555').text('FACTURA REF.:', rightX, infoY + 14);
      doc.font('Helvetica').fontSize(9).fillColor('#000').text(orden.FacturaReferencia || '—', rightX + 90, infoY + 14);

      doc.moveDown(3.5);

      /* ── Tabla de detalle ─────────────────────────── */
      doc.moveTo(50, doc.y).lineTo(545, doc.y).lineWidth(0.5).strokeColor('#aaa').stroke();

      // Cabecera de tabla
      const tableTop = doc.y + 6;
      const colDesc  = 50;
      const colCant  = 270;
      const colPU    = 340;
      const colSubt  = 415;
      const colTotal = 475;

      doc.fillColor('#1a3c5e').rect(50, tableTop, 495, 18).fill();
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#fff');
      doc.text('DESCRIPCIÓN',   colDesc,  tableTop + 5, { width: 200 });
      doc.text('CANT.',         colCant,  tableTop + 5, { width: 60, align: 'right' });
      doc.text('P.UNITARIO',    colPU,    tableTop + 5, { width: 70, align: 'right' });
      doc.text('SUBTOTAL',      colSubt,  tableTop + 5, { width: 55, align: 'right' });
      doc.text('TOTAL',         colTotal, tableTop + 5, { width: 65, align: 'right' });

      // Filas
      let rowY = tableTop + 20;
      doc.font('Helvetica').fontSize(8).fillColor('#000');
      detalle.forEach((item, idx) => {
        if (rowY > 730) {
          doc.addPage();
          rowY = 50;
        }
        const bg = idx % 2 === 0 ? '#f5f8ff' : '#ffffff';
        doc.fillColor(bg).rect(50, rowY, 495, 16).fill();
        doc.fillColor('#000');

        const nombre = item.Descripcion ||
          (item.ProductoNombre && item.ProductoNombre !== '' ? `${item.ProductoSKU ? item.ProductoSKU + ' - ' : ''}${item.ProductoNombre}` : item.MateriaPrimaNombre) ||
          '—';
        doc.text(nombre,                                   colDesc,  rowY + 3, { width: 210 });
        doc.text(Number(item.Cantidad).toFixed(2),         colCant,  rowY + 3, { width: 60,  align: 'right' });
        doc.text(fmt(item.PrecioCompra),                   colPU,    rowY + 3, { width: 70,  align: 'right' });
        doc.text(fmt(item.Subtotal),                       colSubt,  rowY + 3, { width: 55,  align: 'right' });
        doc.text(fmt(item.Total),                          colTotal, rowY + 3, { width: 65,  align: 'right' });
        rowY += 16;
      });

      doc.moveTo(50, rowY).lineTo(545, rowY).lineWidth(0.5).strokeColor('#aaa').stroke();
      rowY += 10;

      /* ── Totales ──────────────────────────────────── */
      const totalesX = 380;
      doc.font('Helvetica').fontSize(9).fillColor('#333');
      doc.text('Subtotal:',   totalesX, rowY,      { width: 80, align: 'right' });
      doc.text(fmt(orden.Subtotal), totalesX + 85, rowY, { width: 80, align: 'right' });
      doc.text('IVA:',        totalesX, rowY + 14, { width: 80, align: 'right' });
      doc.text(fmt(orden.IVA),     totalesX + 85, rowY + 14, { width: 80, align: 'right' });

      doc.font('Helvetica-Bold').fontSize(11).fillColor('#1a3c5e');
      doc.text('TOTAL:',      totalesX, rowY + 30, { width: 80, align: 'right' });
      doc.text(fmt(orden.Total),   totalesX + 85, rowY + 30, { width: 80, align: 'right' });

      rowY += 60;

      /* ── Observaciones ──────────────────────────────── */
      if (orden.Observaciones) {
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#555').text('Observaciones:', 50, rowY);
        doc.font('Helvetica').fontSize(8).fillColor('#333').text(orden.Observaciones, 50, rowY + 12, { width: 495 });
        rowY += 40;
      }

      /* ── Firmas ──────────────────────────────────────── */
      if (rowY > 700) { doc.addPage(); rowY = 50; }
      rowY += 20;
      doc.moveTo(80, rowY + 40).lineTo(220, rowY + 40).lineWidth(0.7).strokeColor('#333').stroke();
      doc.moveTo(330, rowY + 40).lineTo(470, rowY + 40).lineWidth(0.7).strokeColor('#333').stroke();

      doc.font('Helvetica').fontSize(8).fillColor('#555')
         .text('Autorización Nivel 1', 80,  rowY + 44, { width: 140, align: 'center' })
         .text('Autorización Nivel 2', 330, rowY + 44, { width: 140, align: 'center' });

      /* ── Footer ──────────────────────────────────────── */
      doc.fontSize(7).fillColor('#aaa')
         .text(`Generado el ${new Date().toLocaleString('es-MX')}`, 50, 790, { align: 'center', width: 495 });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};
