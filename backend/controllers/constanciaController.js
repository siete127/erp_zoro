const xml2js = require('xml2js');
const pdfParse = require('pdf-parse');

function extractFromPDF(text) {
  const data = { Address: {} };
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  let streetPrefix = '';
  let colonyName = '';
  
  // 1) RFC: primero intentar con etiqueta típica "RFC:" de constancia SAT
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const labeledRfc = line.match(/RFC\s*[:\-]?\s*([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{2,3})/i);
    if (labeledRfc) {
      data.RFC = labeledRfc[1].toUpperCase();
      break;
    }
  }

  // Si no se encontró con etiqueta, buscar cualquier RFC en el texto como respaldo
  if (!data.RFC) {
    for (let i = 0; i < lines.length; i++) {
      const anyRfc = lines[i].match(/\b([A-ZÑ&]{3,4}\d{6}[A-Z0-9]{2,3})\b/);
      if (anyRfc) {
        data.RFC = anyRfc[1].toUpperCase();
        break;
      }
    }
  }
  
  // Buscar campos específicos
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const nextLine = i < lines.length - 1 ? lines[i + 1] : '';
    const lower = line.toLowerCase();
    
    // Denominación / Razón Social
    // 1) Formato "Denominación/RazónSocial: SUPERCOTTON" o en la siguiente línea
    if (!data.LegalName && /denominaci[oó]n\/?raz[oó]nsocial/i.test(lower)) {
      const match = line.match(/Denominaci[oó]n\/?Raz[oó]n\s*Social\s*:?\s*(.+)/i);
      if (match && match[1] && match[1].trim().length > 1) {
        data.LegalName = match[1].replace(/[,\.]+$/, '').trim();
      } else if (nextLine && nextLine.trim().length > 1 && !/reg[ií]men|rfc|idcif/i.test(nextLine)) {
        data.LegalName = nextLine.replace(/[,\.]+$/, '').trim();
      }
    }

    // 2) Formato "Nombre, denominación o razón social" (puede venir partido en varias líneas)
    if (!data.LegalName && /nombre.*denominaci[oó]n o raz[oó]n social/i.test(lower)) {
      const match = line.match(/Nombre.*denominaci[oó]n o raz[oó]n social[^:]*:?\s*(.+)/i);
      if (match && match[1] && match[1].trim().length > 1) {
        data.LegalName = match[1].replace(/[,\.]+$/, '').trim();
      } else if (nextLine && nextLine.trim().length > 1 && nextLine.trim().toLowerCase() !== 'social') {
        // Evitar que la palabra "social" (continuación de la etiqueta) sea tomada como nombre
        data.LegalName = nextLine.replace(/[,\.]+$/, '').trim();
      }
    }

    // Nombre comercial (NombreComercial: SUPERCOTTON)
    if (!data.CommercialName && /nombrecomercial/i.test(lower)) {
      const match = line.match(/NombreComercial[^:]*:?\s*(.+)/i);
      if (match && match[1] && match[1].trim().length > 1) {
        data.CommercialName = match[1].replace(/[,\.]+$/, '').trim();
      } else if (nextLine && nextLine.trim().length > 1) {
        data.CommercialName = nextLine.replace(/[,\.]+$/, '').trim();
      }
    }
    
    // Régimen Fiscal: 1) buscar código de 3 dígitos después de la etiqueta
    if (!data.TaxRegime && /R[eé]gimen\s+Fiscal/i.test(line)) {
      const match = line.match(/R[eé]gimen\s+Fiscal[^0-9]*(\d{3})/i);
      if (match) {
        data.TaxRegime = match[1];
      }
    }

    // 2) Fallback para constancias que sólo traen la descripción
    //    Ej: "Régimen General de Ley Personas Morales23/02/2007"
    if (!data.TaxRegime && /reg[ií]men\s+general\s+de\s+ley/i.test(lower)) {
      const match = line.match(/(R[eé]gimen[^0-9]+)/i);
      if (match && match[1]) {
        data.TaxRegime = match[1].trim();
      }
    }
    
    // Código Postal (acepta "Código Postal", "CódigoPostal" o "C.P.")
    if (!data.Address.PostalCode && /(C[oó]digo\s*Postal|C\.?P\.?)/i.test(line)) {
      const match = line.match(/(\d{5})/);
      if (match) data.Address.PostalCode = match[1];
    }

    // Tipo de vialidad (Calle, Avenida, etc.) para prefijo de la calle
    if (!streetPrefix && /tipodevialidad/i.test(lower)) {
      const m = line.match(/TipodeVialidad[^:]*:([^:]+)/i);
      if (m && m[1] && m[1].trim().length > 0) {
        streetPrefix = m[1].trim();
      }
    }

    // Colonia
    if (!colonyName && /colonia:/i.test(lower)) {
      const m = line.match(/Colonia:([^:]+)/i);
      if (m && m[1] && m[1].trim().length > 0) {
        colonyName = m[1].trim();
      }
    }
    
    // Estado: en constancias recientes viene como "Nombredela EntidadFederativa:PUEBLAEntreCalle:..."
    if (!data.Address.State && /entidad\s*federativa/i.test(lower)) {
      const match = line.match(/Entidad\s*Federativa[^:]*:?\s*(.+)/i);
      let value = '';
      if (match && match[1]) value = match[1].trim();
      else if (nextLine) value = nextLine.trim();

      if (value) {
        // Cortar cualquier sufijo "EntreCalle" o "Y Calle"
        value = value.split(/EntreCalle|Y\s+Calle/i)[0].trim();
        if (value && value !== ':') data.Address.State = value;
      }
    }

    // Municipio / Ciudad: "NombredelMunicipioo DemarcaciónTerritorial: PUEBLA" o Localidad
    if (!data.Address.City && /municipioo\s*demarcaci[oó]nterritorial/i.test(lower)) {
      const match = line.match(/Municipioo\s*Demarcaci[oó]nTerritorial[^:]*:?\s*(.+)/i);
      let value = '';
      if (match && match[1]) value = match[1].trim();
      else if (nextLine) value = nextLine.trim();
      if (value && value !== ':') data.Address.City = value;
    }
    if (!data.Address.City && /nombredela\s*localidad/i.test(lower)) {
      const match = line.match(/Localidad[^:]*:?\s*(.+)/i);
      let value = '';
      if (match && match[1]) value = match[1].trim();
      else if (nextLine) value = nextLine.trim();
      if (value && value !== ':') data.Address.City = value;
    }
    
    // Calle / Vialidad: usar "NombredeVialidad" + NúmeroExterior
    if (/nombredevialidad/i.test(line)) {
      let streetName = '';
      const match = line.match(/NombredeVialidad[^:]*:?\s*(.+)/i);
      if (match && match[1] && match[1].trim().length > 0) {
        streetName = match[1].trim();
      } else if (nextLine && nextLine.trim().length > 0) {
        streetName = nextLine.trim();
      }
      if (streetName) {
        data.Address.Street = streetName;
      }
    }
    if (/numeroexterior/i.test(lower)) {
      let num = '';
      const match = line.match(/NumeroExterior[^:]*:?\s*(.+)/i);
      if (match && match[1] && match[1].trim().length > 0) {
        num = match[1].trim();
      } else if (nextLine && /^\d+/.test(nextLine.trim())) {
        num = nextLine.trim();
      }
      if (num) {
        if (data.Address.Street) data.Address.Street = `${data.Address.Street} ${num}`;
        else data.Address.Street = num;
      }
    }
  }
  // Fallbacks basados en el texto completo (multi-línea)
  const full = text.replace(/\r/g, '');

  // Calle: NombredeVialidad (puede ir en la siguiente línea) + NumeroExterior
  if (!data.Address.Street || data.Address.Street === ':' || /^CALLE\s*:?$/i.test(data.Address.Street)) {
    const mStreet = full.match(/NombredeVialidad:\s*([^\n]*)\n([^\n]+)/i);
    if (mStreet) {
      const name = (mStreet[1].trim() || mStreet[2].trim());
      if (name) {
        let exterior = '';
        const mExt = full.match(/NumeroExterior:\s*([^\n]*)\n?([^\n]*)?/i);
        if (mExt) {
          exterior = (mExt[1].trim() || mExt[2].trim());
        }
        data.Address.Street = exterior ? `${name} ${exterior}` : name;
      }
    }
  }

  // Ciudad: Nombredela Localidad o NombredelMunicipioo DemarcaciónTerritorial
  if (!data.Address.City) {
    let city = '';
    const mLoc = full.match(/Nombredela\s+Localidad:\s*([^\n]*)\n([^\n]+)/i);
    if (mLoc) {
      city = (mLoc[1].trim() || mLoc[2].trim());
    }
    if (!city) {
      const mMun = full.match(/NombredelMunicipioo\s+Demarcaci[oó]nTerritorial:\s*([^\n]*)\n([^\n]+)/i);
      if (mMun) city = (mMun[1].trim() || mMun[2].trim());
    }
    if (city) data.Address.City = city;
  }

  // Estado: Nombredela EntidadFederativa (cortar "EntreCalle" si viene pegado)
  if (!data.Address.State) {
    const mState = full.match(/Nombredela\s+EntidadFederativa:([^\n]+)/i);
    if (mState && mState[1]) {
      let value = mState[1].trim();
      value = value.split(/EntreCalle|YCalle|Y\s+Calle/i)[0].trim();
      if (value) data.Address.State = value;
    }
  }

  // Régimen Fiscal: si aún no se obtuvo, buscar dentro del bloque de "Regímenes"
  if (!data.TaxRegime) {
    // Cortamos el texto a partir de "Regímenes:" y analizamos línea por línea
    const parts = full.split(/Reg[ií]menes:/i);
    if (parts.length > 1) {
      const regLines = parts[1]
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0);
      let desc = '';
      for (const l of regLines) {
        if (/R[eé]gimen/i.test(l) && !/Fecha/i.test(l)) {
          desc = l;
          break;
        }
      }
      if (desc) {
        // Ejemplo: "Régimen General de Ley Personas Morales23/02/2007"
        desc = desc.replace(/\d{1,2}\/\d{1,2}\/\d{2,4}.*/, '').trim();
        data.TaxRegime = desc;
      }
    }
  }
  // Post-procesar calle con prefijo de vialidad y colonia
  if (data.Address.Street) {
    let street = data.Address.Street.trim();
    if (streetPrefix) street = `${streetPrefix} ${street}`;
    if (colonyName) street = `${street}, COL. ${colonyName}`;
    data.Address.Street = street.trim();
  }
  
  data.Address.Country = 'México';
  return data;
}

function extractFromXML(xmlContent) {
  const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });
  return parser.parseStringPromise(xmlContent).then(result => {
    const data = {};
    const root = result['Constancia'] || result['constancia'] || result;
    
    if (root) {
      data.RFC = root.RFC || root.rfc || '';
      data.LegalName = root.RazonSocial || root.razonSocial || root.Nombre || root.nombre || '';
      data.CommercialName = root.NombreComercial || root.nombreComercial || root.CommercialName || root.commercialName || '';
      data.TaxRegime = root.RegimenFiscal || root.regimenFiscal || root.Regimen || root.regimen || '';
      
      const domicilio = root.Domicilio || root.domicilio || root.DomicilioFiscal || root.domicilioFiscal || {};
      data.Address = {
        Street: domicilio.Calle || domicilio.calle || '',
        City: domicilio.Municipio || domicilio.municipio || domicilio.Ciudad || domicilio.ciudad || '',
        State: domicilio.Estado || domicilio.estado || '',
        PostalCode: domicilio.CodigoPostal || domicilio.codigoPostal || domicilio.CP || domicilio.cp || '',
        Country: domicilio.Pais || domicilio.pais || 'México'
      };
    }
    return data;
  });
}

exports.parseConstancia = async (req, res) => {
  try {
    console.log('=== INICIO PARSE CONSTANCIA ===');
    console.log('Files recibidos:', req.files ? Object.keys(req.files) : 'ninguno');
    
    if (!req.files || !req.files.constancia) {
      console.log('Error: No se recibió archivo');
      return res.status(400).json({ msg: 'No se recibió archivo' });
    }

    const file = req.files.constancia;
    const fileName = file.name.toLowerCase();
    console.log('Archivo:', fileName, 'Tamaño:', file.size);
    
    let data = {};

    if (fileName.endsWith('.pdf')) {
      console.log('Procesando PDF...');
      const pdfData = await pdfParse(file.data);
      console.log('\n=== TEXTO COMPLETO DEL PDF ===');
      console.log(pdfData.text);
      console.log('=== FIN TEXTO PDF ===\n');
      data = extractFromPDF(pdfData.text);
      console.log('Datos extraídos:', JSON.stringify(data, null, 2));
    } else if (fileName.endsWith('.xml')) {
      console.log('Procesando XML...');
      const xmlContent = file.data.toString('utf8');
      data = await extractFromXML(xmlContent);
      console.log('Datos extraídos:', data);
    } else {
      console.log('Formato no soportado:', fileName);
      return res.status(400).json({ msg: 'Formato no soportado. Use PDF o XML' });
    }

    console.log('=== CONSTANCIA PROCESADA EXITOSAMENTE ===');
    res.json({ success: true, data });
  } catch (err) {
    console.error('=== ERROR PARSEANDO CONSTANCIA ===');
    console.error('Mensaje:', err.message);
    console.error('Stack:', err.stack);
    res.status(500).json({ msg: 'Error procesando archivo', error: err.message });
  }
};

// Export interno para pruebas/scripts
exports._extractFromPDF = extractFromPDF;
