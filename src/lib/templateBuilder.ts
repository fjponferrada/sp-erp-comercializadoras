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

export function buildTemplateDataFromContract(contract: any, cData: any, product: any, isB2B: boolean) {
  const dirTitObj = extractAddrObj(cData.direccion || contract.client?.billingAddress);
  const dirPSObj = extractAddrObj(cData.direccionSuministro || contract.supplyPoint?.address);

  // Separar nombre y apellidos
  let nombreTitular = formatField(contract.client?.businessName || cData.nombre || cData.businessName) || '';
  let apellido1 = formatField(contract.client?.lastName || cData.primerApellido) || '';
  let apellido2 = formatField(contract.client?.lastName2 || cData.segundoApellido) || '';

  if (!apellido1 && contract.client?.firstName) {
    nombreTitular = formatField(contract.client.firstName);
  }

  if (!apellido1 && nombreTitular && !contract.client?.firstName && contract.client?.clientType === 'FÍSICA') {
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

  if (nombreTitular && apellido1) {
    nombreTitular = nombreTitular.replace(new RegExp(apellido1, 'ig'), '').trim();
  }
  if (nombreTitular && apellido2) {
    nombreTitular = nombreTitular.replace(new RegExp(apellido2, 'ig'), '').trim();
  }
  nombreTitular = nombreTitular.replace(/\s+/g, ' ').trim();

  const sp = contract.supplyPoint || {};
  const cl = contract.client || {};

  return {
    nombretit: nombreTitular,
    '1apetit': apellido1,
    '2apetit': apellido2,
    nif: formatField(cl.vatNumber || cData.nif || cData.cif) || '',
    cnae: formatField(cData.cnae || sp.sipsCnae) || '',
    direcciontitular: formatField(getTitularAddress(cData)) || formatField(cl.billingAddress) || '',
    cptit: formatField(cData.cp) || dirTitObj.cp || formatField(cl.billingPostalCode) || '',
    loctit: formatField(cData.poblacion) || dirTitObj.poblacion || formatField(cl.billingCity) || '',
    provtit: formatField(cData.provincia) || dirTitObj.provincia || formatField(cl.billingProvince) || '',
    mailtitular: formatField(cl.contactEmail || cData.email) || '',
    tlftitular: formatField(cl.contactPhone || cData.telefono) || '',
    mvtitular: formatField(cl.contactPhone || cData.telefono) || '',
    nombrerep: formatField(cl.representativeName || cData.contactoNombre) || '',
    nifrep: formatField(cl.representativeVat || cData.contactoNif) || '',
    iban: formatField(sp.iban || cData.iban) || '',
    cups: formatField(sp.cups || cData.cups) || '',
    direccionPS: formatField(getSupplyAddress(cData)) || formatField(sp.address) || '',
    cpPS: formatField(cData.sCp || cData['Código Postal Instalación']) || dirPSObj.cp || formatField(sp.postalCode) || '',
    localidadPS: formatField(cData.sPoblacion || cData['Población Instalación']) || dirPSObj.poblacion || formatField(sp.city) || '',
    provPS: formatField(cData.sProvincia || cData['Provincia Instalación']) || dirPSObj.provincia || formatField(sp.province) || '',
    tarifa: formatField(contract.tarifa || contract.supplyPoint?.tariff || cData.tarifa || sp.sipsTariff) || '',
    p1c: formatField(contract.p1c || cData.p1c || cData.p1) || '',
    p2c: formatField(contract.p2c || cData.p2c || cData.p2) || '',
    p3c: formatField(contract.p3c || cData.p3c || cData.p3) || '',
    p4c: formatField(contract.p4c || cData.p4c || cData.p4) || '',
    p5c: formatField(contract.p5c || cData.p5c || cData.p5) || '',
    p6c: formatField(contract.p6c || cData.p6c || cData.p6) || '',
    producto: formatField(product?.name || cData.producto) || '',
    p1p: formatField(product?.p1 || contract.p1p || cData.p1p) || '',
    p2p: formatField(product?.p2 || contract.p2p || cData.p2p) || '',
    p3p: formatField(product?.p3 || contract.p3p || cData.p3p) || '',
    p4p: formatField(product?.p4 || contract.p4p || cData.p4p) || '',
    p5p: formatField(product?.p5 || contract.p5p || cData.p5p) || '',
    p6p: formatField(product?.p6 || contract.p6p || cData.p6p) || '',
    p1e: formatField(product?.e1 || contract.p1e || cData.p1e) || '',
    p2e: formatField(product?.e2 || contract.p2e || cData.p2e) || '',
    p3e: formatField(product?.e3 || contract.p3e || cData.p3e) || '',
    p4e: formatField(product?.e4 || contract.p4e || cData.p4e) || '',
    p5e: formatField(product?.e5 || contract.p5e || cData.p5e) || '',
    p6e: formatField(product?.e6 || contract.p6e || cData.p6e) || '',
    fee: formatField(contract.fee || product?.fee || cData.fee) || '',
    feee: formatField(contract.svaConcept || product?.svaConcept || cData.feee) || '',
    conpexc: formatField(product?.feeExcedentes || contract.commissionBase || cData.conpexc) || '',
    pexc: formatField(product?.pexc || cData.pexc) || '',
    f1: formatField(product?.f1 || cData.f1) || '',
    f2: formatField(product?.f2 || cData.f2) || '',
    f3: formatField(product?.f3 || cData.f3) || '',
    f4: formatField(product?.f4 || cData.f4) || '',
    f5: formatField(product?.f5 || cData.f5) || '',
    f6: formatField(product?.f6 || cData.f6) || '',
  };
}
