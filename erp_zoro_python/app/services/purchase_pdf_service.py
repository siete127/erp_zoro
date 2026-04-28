from __future__ import annotations

from io import BytesIO
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas


def _money(value: Any) -> str:
    return f"${float(value or 0):,.2f}"


def _date(value: Any) -> str:
    if not value:
        return "-"
    try:
        return value.strftime("%d/%m/%Y")
    except AttributeError:
        return str(value)


def _draw_label_value(pdf: canvas.Canvas, label: str, value: str, x: float, y: float) -> None:
    pdf.setFont("Helvetica-Bold", 8)
    pdf.setFillColor(colors.HexColor("#555555"))
    pdf.drawString(x, y, label)
    pdf.setFont("Helvetica", 9)
    pdf.setFillColor(colors.black)
    pdf.drawString(x + stringWidth(label, "Helvetica-Bold", 8) + 3, y, value or "-")


def generar_pdf_orden_compra(orden: dict[str, Any]) -> bytes:
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    margin_x = 18 * mm
    current_y = height - 22 * mm

    pdf.setTitle(f"Orden de Compra {orden.get('NumeroOC')}")
    pdf.setFont("Helvetica-Bold", 18)
    pdf.setFillColor(colors.HexColor("#1a3c5e"))
    pdf.drawCentredString(width / 2, current_y, "ORDEN DE COMPRA")
    current_y -= 8 * mm

    pdf.setFont("Helvetica", 11)
    pdf.setFillColor(colors.black)
    pdf.drawCentredString(width / 2, current_y, f"No. {orden.get('NumeroOC') or '-'}")
    current_y -= 6 * mm

    pdf.setStrokeColor(colors.HexColor("#1a3c5e"))
    pdf.setLineWidth(1.2)
    pdf.line(margin_x, current_y, width - margin_x, current_y)
    current_y -= 8 * mm

    left_x = margin_x
    right_x = width / 2 + 8 * mm

    pdf.setFont("Helvetica-Bold", 8)
    pdf.setFillColor(colors.HexColor("#555555"))
    pdf.drawString(left_x, current_y, "EMPRESA:")
    pdf.drawString(right_x, current_y, "PROVEEDOR:")

    pdf.setFont("Helvetica", 10)
    pdf.setFillColor(colors.black)
    pdf.drawString(left_x, current_y - 10, str(orden.get("Empresa") or "-"))
    pdf.drawString(right_x, current_y - 10, str(orden.get("Proveedor") or "-"))

    pdf.setFont("Helvetica", 8)
    pdf.setFillColor(colors.HexColor("#555555"))
    pdf.drawString(left_x, current_y - 22, f"RFC: {orden.get('EmpresaRFC') or '-'}")
    pdf.drawString(right_x, current_y - 22, f"RFC: {orden.get('ProveedorRFC') or '-'}")
    if orden.get("ProveedorEmail"):
        pdf.drawString(right_x, current_y - 32, f"Email: {orden.get('ProveedorEmail')}")

    current_y -= 18 * mm

    _draw_label_value(pdf, "FECHA OC:", _date(orden.get("FechaOC")), left_x, current_y)
    _draw_label_value(
        pdf,
        "FECHA REQUERIDA:",
        _date(orden.get("FechaRequerida")),
        left_x,
        current_y - 10,
    )
    _draw_label_value(pdf, "MONEDA:", str(orden.get("Moneda") or "MXN"), left_x, current_y - 20)
    _draw_label_value(pdf, "ESTATUS:", str(orden.get("Estatus") or "-"), right_x, current_y)
    _draw_label_value(
        pdf,
        "FACTURA REF.:",
        str(orden.get("FacturaReferencia") or "-"),
        right_x,
        current_y - 10,
    )

    current_y -= 34 * mm

    table_x = margin_x
    table_w = width - (2 * margin_x)
    row_h = 7 * mm
    columns = [
        ("DESCRIPCION", 82 * mm),
        ("CANT.", 22 * mm),
        ("P.UNITARIO", 28 * mm),
        ("SUBTOTAL", 24 * mm),
        ("TOTAL", 24 * mm),
    ]

    pdf.setFillColor(colors.HexColor("#1a3c5e"))
    pdf.rect(table_x, current_y, table_w, row_h, fill=1, stroke=0)
    pdf.setFont("Helvetica-Bold", 7)
    pdf.setFillColor(colors.white)

    cursor_x = table_x + 2 * mm
    for title, col_width in columns:
        pdf.drawString(cursor_x, current_y + 2.5 * mm, title)
        cursor_x += col_width

    current_y -= row_h
    detalle = orden.get("detalle") or []
    for index, item in enumerate(detalle):
        if current_y < 40 * mm:
            pdf.showPage()
            current_y = height - 22 * mm
        bg = colors.HexColor("#f5f8ff") if index % 2 == 0 else colors.white
        pdf.setFillColor(bg)
        pdf.rect(table_x, current_y, table_w, row_h, fill=1, stroke=0)
        pdf.setFont("Helvetica", 7)
        pdf.setFillColor(colors.black)

        descripcion = (
            item.get("Descripcion")
            or (
                f"{item.get('ProductoSKU') or ''} - {item.get('ProductoNombre') or ''}".strip(" -")
                if item.get("Producto_Id")
                else item.get("MateriaPrimaNombre")
            )
            or "-"
        )

        values = [
            str(descripcion),
            f"{float(item.get('Cantidad') or 0):.2f}",
            _money(item.get("PrecioCompra")),
            _money(item.get("Subtotal")),
            _money(item.get("Total")),
        ]

        cursor_x = table_x + 2 * mm
        for col_index, ((_, col_width), value) in enumerate(zip(columns, values, strict=True)):
            align_right = col_index > 0
            text_x = cursor_x + col_width - 2 * mm if align_right else cursor_x
            if align_right:
                text_width = stringWidth(value, "Helvetica", 7)
                text_x -= text_width
            pdf.drawString(text_x, current_y + 2.5 * mm, value)
            cursor_x += col_width

        current_y -= row_h

    current_y -= 4 * mm
    total_x = width - margin_x - 58 * mm
    _draw_label_value(pdf, "Subtotal:", _money(orden.get("Subtotal")), total_x, current_y)
    _draw_label_value(pdf, "IVA:", _money(orden.get("IVA")), total_x, current_y - 10)
    pdf.setFont("Helvetica-Bold", 10)
    pdf.setFillColor(colors.HexColor("#1a3c5e"))
    pdf.drawString(total_x, current_y - 24, "TOTAL:")
    pdf.drawRightString(width - margin_x, current_y - 24, _money(orden.get("Total")))
    current_y -= 34

    if orden.get("Observaciones"):
        pdf.setFont("Helvetica-Bold", 8)
        pdf.setFillColor(colors.HexColor("#555555"))
        pdf.drawString(margin_x, current_y, "Observaciones:")
        pdf.setFont("Helvetica", 8)
        pdf.setFillColor(colors.black)
        text = pdf.beginText(margin_x, current_y - 10)
        for line in str(orden.get("Observaciones")).splitlines() or [""]:
            text.textLine(line[:120])
        pdf.drawText(text)
        current_y -= 20

    if current_y < 35 * mm:
        pdf.showPage()
        current_y = height - 40 * mm
    else:
        current_y -= 22 * mm

    pdf.setStrokeColor(colors.black)
    pdf.setLineWidth(0.8)
    pdf.line(margin_x + 10 * mm, current_y, margin_x + 60 * mm, current_y)
    pdf.line(width - margin_x - 60 * mm, current_y, width - margin_x - 10 * mm, current_y)
    pdf.setFont("Helvetica", 8)
    pdf.setFillColor(colors.HexColor("#555555"))
    pdf.drawCentredString(margin_x + 35 * mm, current_y - 10, "Autorizacion Nivel 1")
    pdf.drawCentredString(width - margin_x - 35 * mm, current_y - 10, "Autorizacion Nivel 2")

    pdf.setFont("Helvetica", 7)
    pdf.setFillColor(colors.HexColor("#999999"))
    pdf.drawCentredString(width / 2, 12 * mm, "Generado por ERP Zoro Python")

    pdf.showPage()
    pdf.save()
    return buffer.getvalue()
