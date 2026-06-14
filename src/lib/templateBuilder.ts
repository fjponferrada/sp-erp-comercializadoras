function formatField(field: any): string {
  if (!field) return '';
  if (typeof field === 'string') return field.toUpperCase();
  return String(field).toUpperCase();
}

function extractAddrObj(field: any) {
  if (!field) return {};
  if (typeof field === 'string' && field.startsWith('{')) {
    try { return JSON.parse(field); } catch(e){ return {}; }
  }
  if (typeof field === 'object' && !Array.isArray(field)) return field;
  return {};
}

function getAddressString(field: any): string {
  if (!field) return '';
  if (typeof field === 'string') {
    if (field.startsWith('{')) {
      try {
        const obj = JSON.parse(field);
        return obj.address || obj.direccion || obj.fullAddress || '';
      } catch(e) {
        return field;
      }
    }
    return field;
  }
  if (typeof field === 'object') {
    return field.address || field.direccion || field.fullAddress || '';
  }
  return String(field);
}

export function getTitularAddress(cData: any): string {
  if (!cData) return '';
  if (cData['Domicilio Titular Completo']) return String(cData['Domicilio Titular Completo']);
  if (cData.nombreVia) {
    const parts = [cData.tipoVia, cData.nombreVia, cData.tipoNumeracion, cData.numKm, cData.adicional].filter(Boolean);
    if (parts.length > 0) return parts.join(' ');
  }
  return getAddressString(cData.direccion);
}

export function getSupplyAddress(cData: any): string {
  if (!cData) return '';
  if (cData['DOMICILIO PS COMPLETO']) return String(cData['DOMICILIO PS COMPLETO']);
  if (cData['Domicilio Instalación Completo']) return String(cData['Domicilio Instalación Completo']);
  if (cData.sNombreVia) {
    const parts = [cData.sTipoVia, cData.sNombreVia, cData.sTipoNumeracion, cData.sNumero, cData.sAdicional].filter(Boolean);
    if (parts.length > 0) return parts.join(' ');
  }
  return getAddressString(cData.direccionSuministro);
}

export function buildTemplateDataFromLead(lead: any, cData: any, product: any, contract: any, isB2B: boolean, client: any = null, supplyPoint: any = null) {
  // Parsing titular address
  const dirTitObj = extractAddrObj(cData.direccion);
  const dirPSObj = extractAddrObj(cData.direccionSuministro);

  // Separar nombre y apellidos
  let nombreTitular = formatField(lead.businessName) || '';
  let apellido1 = formatField(cData.primerApellido) || '';
  let apellido2 = formatField(cData.segundoApellido) || '';

  if (!apellido1 && nombreTitular) {
    const tokens = nombreTitular.split(/\s+/);
    if (tokens.length >= 3) {
      apellido2 = tokens.pop() || '';
      apellido1 = tokens.pop() || '';
      nombreTitular = tokens.join(' ');
    } else if (tokens.length === 2) {
      apellido1 = tokens.pop() || '';
      nombreTitular = tokens[0];
    }
  }

  // Si a pesar de todo, nombreTitular contiene los apellidos (porque ya venía separado pero también en el nombre), lo limpiamos
  if (nombreTitular && apellido1) {
    nombreTitular = nombreTitular.replace(new RegExp(apellido1, 'ig'), '').trim();
  }
  if (nombreTitular && apellido2) {
    nombreTitular = nombreTitular.replace(new RegExp(apellido2, 'ig'), '').trim();
  }
  nombreTitular = nombreTitular.replace(/\s+/g, ' ').trim(); // clean multiple spaces

  const sp = supplyPoint || contract?.supplyPoint || {};

  return {
    nombretit: nombreTitular,
    '1apetit': apellido1,
    '2apetit': apellido2,
    nif: formatField(lead.vatNumber) || '',
    cnae: formatField(cData.cnae) || '',
    direcciontitular: formatField(getTitularAddress(cData)) || formatField(sp.address) || '',
    cptit: formatField(cData.cp) || dirTitObj.cp || formatField(sp.postalCode) || '',
    loctit: formatField(cData.poblacion) || dirTitObj.poblacion || formatField(sp.city) || '',
    provtit: formatField(cData.provincia) || dirTitObj.provincia || formatField(sp.province) || '',
    mailtitular: formatField(lead.email) || '',
    tlftitular: formatField(lead.phone) || '',
    mvtitular: '',
    nombrerep: formatField(cData.representanteLegal) || formatField(cData.contactoNombre ? `${cData.contactoNombre} ${cData.contactoApellidos || ''}` : '') || '',
    nifrep: formatField(cData.dniRepresentante) || formatField(cData.contactoNif) || '',
    cups: formatField(lead.cups) || '',
    tarifa: formatField(lead.tariff) || formatField(cData.tarifa) || '',
    direccionPS: formatField(getSupplyAddress(cData)) || formatField(getTitularAddress(cData)) || formatField(sp.address) || '',
    cpPS: formatField(cData.sCp) || formatField(cData.direccionSuministro?.postalCode) || formatField(cData.cp) || dirPSObj.cp || dirTitObj.cp || formatField(sp.postalCode) || '',
    localidadPS: formatField(cData.sPoblacion) || formatField(cData.direccionSuministro?.city) || formatField(cData.poblacion) || dirPSObj.poblacion || dirTitObj.poblacion || formatField(sp.city) || '',
    provPS: formatField(cData.sProvincia) || formatField(cData.direccionSuministro?.province) || formatField(cData.provincia) || dirPSObj.provincia || dirTitObj.provincia || formatField(sp.province) || '',
    ftraspapel: (cData.facturasPapel === 'Si' || cData.facturaPapel === 'Si') ? 'Correo Postal' : 'Email',
    iban: cData.iban || '',
    nombreprod: product?.name || '',
    tipoprod: product?.type || product?.pricingModel || '',
    fee: contract.fee || '0',
    dsv: contract.deviationCost || '0',
    p1e: contract.p1e || '0', p2e: contract.p2e || '0', p3e: contract.p3e || '0', p4e: contract.p4e || '0', p5e: contract.p5e || '0', p6e: contract.p6e || '0',
    p1c: contract.p1c || '0', p2c: contract.p2c || '0', p3c: contract.p3c || '0', p4c: contract.p4c || '0', p5c: contract.p5c || '0', p6c: contract.p6c || '0',
    p1p: contract.p1p || '0', p2p: contract.p2p || '0', p3p: contract.p3p || '0', p4p: contract.p4p || '0', p5p: contract.p5p || '0', p6p: contract.p6p || '0',
    MESESPERMANENCIA: contract.permanenceMonths || '0',
    servicios: cData.svaConcept || '',
    consumoanual: lead.estimatedMWh ? (lead.estimatedMWh * 1000).toString() : (cData.consumoEstimado || cData.consumoAnual || '0'),
    tramitacion: cData.tipoTramitacion || '',
    modalidadauto: cData.autoconsumo === 'Si' ? 'Con excedentes' : 'Sin autoconsumo',
    pexc: contract.pexc || '0',
    feeexc: contract.feeExcedentes || '0',
    asociarabolsillo: contract.cgBolsilloSolar ? 'Si' : 'No',
    cbolsillosolar: contract.cgBolsilloSolar || '0',
    fechafirma: new Date().toLocaleDateString('es-ES'),
    numcontrato: contract.contractCode || contract.id || '',
  };
}
