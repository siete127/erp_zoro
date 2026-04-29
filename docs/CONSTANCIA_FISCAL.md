# Funcionalidad de Carga de Constancia Fiscal

## Descripción
Esta funcionalidad permite cargar un archivo XML o PDF de constancia fiscal del SAT para rellenar automáticamente los campos del cliente.

## Cómo usar

1. **En el formulario de nuevo cliente**, verás un botón "📄 Cargar Constancia" en la esquina superior derecha de la sección "Información General"

2. **Haz clic en el botón** y selecciona el archivo XML o PDF de la constancia fiscal del SAT

3. **Los campos se rellenarán automáticamente** con la información extraída:
   - RFC
   - Razón Social (LegalName)
   - Régimen Fiscal (TaxRegime)
   - Dirección Fiscal (se agrega automáticamente como dirección tipo "Fiscal")

## Formatos soportados

### PDF
El sistema extrae información de constancias fiscales en formato PDF usando reconocimiento de patrones:
- RFC (13 caracteres alfanuméricos)
- Denominación/Razón Social
- Régimen Fiscal (código de 3 dígitos)
- Domicilio fiscal (Calle, C.P., Estado, Municipio)

### XML
El parser busca los siguientes campos en el XML:
- `RFC` o `rfc`
- `RazonSocial`, `razonSocial`, `Nombre` o `nombre`
- `RegimenFiscal`, `regimenFiscal`, `Regimen` o `regimen`
- Domicilio fiscal con campos:
  - `Calle` o `calle`
  - `Municipio`, `municipio`, `Ciudad` o `ciudad`
  - `Estado` o `estado`
  - `CodigoPostal`, `codigoPostal`, `CP` o `cp`
  - `Pais` o `pais`

## Notas técnicas

- Formatos aceptados: XML y PDF
- Tamaño máximo: 10MB
- La dirección fiscal se agrega automáticamente como dirección principal tipo "Fiscal"
- Los campos existentes no se sobrescriben si ya tienen valor
- Compatible con diferentes estructuras de XML del SAT
- Para PDF, usa reconocimiento de patrones de texto

## Endpoints

### POST /api/constancia/parse
Parsea un archivo XML o PDF de constancia fiscal

**Headers:**
- Authorization: Bearer {token}
- Content-Type: multipart/form-data

**Body:**
- constancia: archivo XML o PDF

**Response:**
```json
{
  "success": true,
  "data": {
    "RFC": "XAXX010101000",
    "LegalName": "Empresa Ejemplo SA de CV",
    "TaxRegime": "601",
    "Address": {
      "Street": "Calle Principal 123",
      "City": "Ciudad de México",
      "State": "CDMX",
      "PostalCode": "01000",
      "Country": "México"
    }
  }
}
```
