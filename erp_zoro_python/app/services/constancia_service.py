import re
import io
from typing import Optional

try:
    from pypdf import PdfReader
except ImportError:
    PdfReader = None

try:
    import xml.etree.ElementTree as ET
except ImportError:
    ET = None


def _extract_from_pdf(text: str) -> dict:
    data: dict = {"Address": {}}
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    street_prefix = ""
    colony_name = ""

    # RFC
    for line in lines:
        m = re.search(r"RFC\s*[:\-]?\s*([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{2,3})", line, re.IGNORECASE)
        if m:
            data["RFC"] = m.group(1).upper()
            break
    if not data.get("RFC"):
        for line in lines:
            m = re.search(r"\b([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{2,3})\b", line)
            if m:
                data["RFC"] = m.group(1).upper()
                break

    for i, line in enumerate(lines):
        next_line = lines[i + 1] if i < len(lines) - 1 else ""
        lower = line.lower()

        # Razón social
        if not data.get("LegalName") and re.search(r"denominaci[oó]n\/?raz[oó]nsocial", lower):
            m = re.search(r"Denominaci[oó]n\/?Raz[oó]n\s*Social\s*:?\s*(.+)", line, re.IGNORECASE)
            if m and m.group(1).strip():
                data["LegalName"] = m.group(1).strip().rstrip(",.")
            elif next_line and not re.search(r"reg[ií]men|rfc|idcif", next_line, re.IGNORECASE):
                data["LegalName"] = next_line.rstrip(",.")

        if not data.get("LegalName") and re.search(r"nombre.*denominaci[oó]n o raz[oó]n social", lower):
            m = re.search(r"Nombre.*denominaci[oó]n o raz[oó]n social[^:]*:?\s*(.+)", line, re.IGNORECASE)
            if m and m.group(1).strip():
                data["LegalName"] = m.group(1).strip().rstrip(",.")
            elif next_line and next_line.strip().lower() != "social":
                data["LegalName"] = next_line.rstrip(",.")

        # Nombre comercial
        if not data.get("CommercialName") and re.search(r"nombrecomercial", lower):
            m = re.search(r"NombreComercial[^:]*:?\s*(.+)", line, re.IGNORECASE)
            if m and m.group(1).strip():
                data["CommercialName"] = m.group(1).strip().rstrip(",.")
            elif next_line:
                data["CommercialName"] = next_line.rstrip(",.")

        # Régimen fiscal
        if not data.get("TaxRegime") and re.search(r"R[eé]gimen\s+Fiscal", line):
            m = re.search(r"R[eé]gimen\s+Fiscal[^0-9]*(\d{3})", line, re.IGNORECASE)
            if m:
                data["TaxRegime"] = m.group(1)

        # CP
        if not data["Address"].get("PostalCode") and re.search(r"C[oó]digo\s*Postal|C\.?P\.?", line):
            m = re.search(r"(\d{5})", line)
            if m:
                data["Address"]["PostalCode"] = m.group(1)

        # Tipo de vialidad
        if not street_prefix and re.search(r"tipodevialidad", lower):
            m = re.search(r"TipodeVialidad[^:]*:([^:]+)", line, re.IGNORECASE)
            if m:
                street_prefix = m.group(1).strip()

        # Colonia
        if not colony_name and re.search(r"colonia:", lower):
            m = re.search(r"Colonia:([^:]+)", line, re.IGNORECASE)
            if m:
                colony_name = m.group(1).strip()

        # Estado
        if not data["Address"].get("State") and re.search(r"entidad\s*federativa", lower):
            m = re.search(r"Entidad\s*Federativa[^:]*:?\s*(.+)", line, re.IGNORECASE)
            value = m.group(1).strip() if m else next_line.strip()
            if value:
                value = re.split(r"EntreCalle|Y\s+Calle", value, flags=re.IGNORECASE)[0].strip()
                if value and value != ":":
                    data["Address"]["State"] = value

        # Ciudad / Municipio
        if not data["Address"].get("City") and re.search(r"municipioo\s*demarcaci[oó]nterritorial", lower):
            m = re.search(r"Municipioo\s*Demarcaci[oó]nTerritorial[^:]*:?\s*(.+)", line, re.IGNORECASE)
            value = m.group(1).strip() if m else next_line.strip()
            if value and value != ":":
                data["Address"]["City"] = value

        if not data["Address"].get("City") and re.search(r"nombredela\s*localidad", lower):
            m = re.search(r"Localidad[^:]*:?\s*(.+)", line, re.IGNORECASE)
            value = m.group(1).strip() if m else next_line.strip()
            if value and value != ":":
                data["Address"]["City"] = value

        # Calle / Vialidad
        if re.search(r"nombredevialidad", line, re.IGNORECASE):
            m = re.search(r"NombredeVialidad[^:]*:?\s*(.+)", line, re.IGNORECASE)
            street_name = m.group(1).strip() if (m and m.group(1).strip()) else next_line.strip()
            if street_name:
                data["Address"]["Street"] = street_name

        if re.search(r"numeroexterior", lower):
            m = re.search(r"NumeroExterior[^:]*:?\s*(.+)", line, re.IGNORECASE)
            num = m.group(1).strip() if (m and m.group(1).strip()) else (next_line.strip() if re.match(r"^\d+", next_line.strip()) else "")
            if num:
                data["Address"]["Street"] = f"{data['Address'].get('Street', '')} {num}".strip()

    # Régimen fallback
    if not data.get("TaxRegime"):
        parts = re.split(r"Reg[ií]menes:", text, flags=re.IGNORECASE)
        if len(parts) > 1:
            for reg_line in parts[1].split("\n"):
                reg_line = reg_line.strip()
                if re.search(r"R[eé]gimen", reg_line) and not re.search(r"Fecha", reg_line):
                    data["TaxRegime"] = re.sub(r"\d{1,2}/\d{1,2}/\d{2,4}.*", "", reg_line).strip()
                    break

    # Post-procesar calle
    if data["Address"].get("Street"):
        street = data["Address"]["Street"].strip()
        if street_prefix:
            street = f"{street_prefix} {street}"
        if colony_name:
            street = f"{street}, COL. {colony_name}"
        data["Address"]["Street"] = street.strip()

    data["Address"]["Country"] = "México"
    return data


def _extract_from_xml(xml_bytes: bytes) -> dict:
    data: dict = {"Address": {}}
    try:
        root = ET.fromstring(xml_bytes)
        ns = {"": root.tag.split("}")[0].strip("{") if "}" in root.tag else ""}

        def get(tag: str) -> str:
            for candidate in [tag, tag.lower(), tag[0].lower() + tag[1:]]:
                el = root.find(candidate)
                if el is not None and el.text:
                    return el.text.strip()
            return ""

        data["RFC"] = get("RFC") or get("rfc")
        data["LegalName"] = get("RazonSocial") or get("razonSocial") or get("Nombre")
        data["CommercialName"] = get("NombreComercial") or get("nombreComercial")
        data["TaxRegime"] = get("RegimenFiscal") or get("regimenFiscal") or get("Regimen")

        domicilio_tags = ["Domicilio", "domicilio", "DomicilioFiscal", "domicilioFiscal"]
        domicilio = None
        for tag in domicilio_tags:
            domicilio = root.find(tag)
            if domicilio is not None:
                break

        if domicilio is not None:
            def dget(t: str) -> str:
                for candidate in [t, t.lower()]:
                    el = domicilio.find(candidate)
                    if el is not None and el.text:
                        return el.text.strip()
                attr = domicilio.get(t) or domicilio.get(t.lower())
                return attr or ""

            data["Address"] = {
                "Street": dget("Calle"),
                "City": dget("Municipio") or dget("Ciudad"),
                "State": dget("Estado"),
                "PostalCode": dget("CodigoPostal") or dget("CP"),
                "Country": dget("Pais") or "México",
            }
    except Exception:
        pass
    return data


async def parse_constancia(file_content: bytes, filename: str) -> dict:
    fname = filename.lower()
    if fname.endswith(".pdf"):
        if PdfReader is None:
            raise ValueError("pypdf no está instalado")
        reader = PdfReader(io.BytesIO(file_content))
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
        return _extract_from_pdf(text)
    elif fname.endswith(".xml"):
        return _extract_from_xml(file_content)
    else:
        raise ValueError("Formato no soportado. Use PDF o XML")
