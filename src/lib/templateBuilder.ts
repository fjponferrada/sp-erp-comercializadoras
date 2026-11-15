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
  const additionalServicesStr = Array.isArray(contract?.additionalServicesSnapshot)
    ? contract.additionalServicesSnapshot.map((s: any) => s.name).join(' - ')
    : cData.svaConcept || '';

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
    nombrerep:
      formatField(cData.representanteLegal) ||
      formatField(cData.contactoNombre ? `${cData.contactoNombre} ${cData.contactoApellidos || ''}`.trim() : '') ||
      formatField(cData.representativeName ? `${cData.representativeName} ${cData.representativeLastName || ''}`.trim() : '') ||
      formatField(client?.representativeName) ||
      '',
    nifrep:
      formatField(cData.dniRepresentante) ||
      formatField(cData.contactoNif) ||
      formatField(cData.representativeVat) ||
      formatField(client?.representativeVat) ||
      '',
    cups: formatField(lead.cups) || '',
    tarifa: formatField(lead.tariff) || formatField(cData.tarifa) || '',
    direccionPS: formatField(getSupplyAddress(cData)) || formatField(getTitularAddress(cData)) || formatField(sp.address) || '',
    cpPS: formatField(cData.sCp) || formatField(cData.direccionSuministro?.postalCode) || formatField(cData.cp) || dirPSObj.cp || dirTitObj.cp || formatField(sp.postalCode) || '',
    localidadPS: formatField(cData.sPoblacion) || formatField(cData.direccionSuministro?.city) || formatField(cData.poblacion) || dirPSObj.poblacion || dirTitObj.poblacion || formatField(sp.city) || '',
    provPS: formatField(cData.sProvincia) || formatField(cData.direccionSuministro?.province) || formatField(cData.provincia) || dirPSObj.provincia || dirTitObj.provincia || formatField(sp.province) || '',
    ftraspapel:
      cData.facturasPapel === 'Si' ||
      cData.facturaPapel === 'Si' ||
      cData.facturasPapel === 'SI' ||
      cData.facturaPapel === 'SI' ||
      cData.envioFactura === 'Postal' ||
      cData.envioFactura === 'Ambos'
        ? 'Correo Postal'
        : 'Email',
    iban: cData.iban || '',
    nombreprod: product?.name || '',
    tipoprod: product?.type || product?.pricingModel || '',
    fee: contract.fee || '0',
    dsv: contract.deviationCost || '0',
    p1e: contract.p1e || '0', p2e: contract.p2e || '0', p3e: contract.p3e || '0', p4e: contract.p4e || '0', p5e: contract.p5e || '0', p6e: contract.p6e || '0',
    p1c: contract.p1c || '0', p2c: contract.p2c || '0', p3c: contract.p3c || '0', p4c: contract.p4c || '0', p5c: contract.p5c || '0', p6c: contract.p6c || '0',
    p1p: contract.p1p || '0', p2p: contract.p2p || '0', p3p: contract.p3p || '0', p4p: contract.p4p || '0', p5p: contract.p5p || '0', p6p: contract.p6p || '0',
    MESESPERMANENCIA: contract.permanenceMonths || '0',
    servicios: additionalServicesStr,
    consumoanual: lead.estimatedMWh ? (lead.estimatedMWh * 1000).toString() : (cData.consumoEstimado || cData.consumoAnual || '0'),
    tramitacion: cData.tipoTramitacion || cData.tramitationType || '',
    modalidadauto:
      cData.autoconsumo === 'Si' ||
      cData.autoconsumo === 'SI' ||
      cData.autoconsumo === 'Sí' ||
      cData.autoconsumo === true ||
      contract?.autoconsumo === true
        ? 'Con excedentes'
        : 'Sin autoconsumo',
    pexc: contract.pexc || '0',
    feeexc: contract.feeExcedentes || '0',
    asociarabolsillo: contract?.bolsilloSolar === true || (contract?.cgBolsilloSolar && Number(contract.cgBolsilloSolar) > 0) ? 'Si' : 'No',
    cbolsillosolar: contract?.bolsilloSolar === true || (contract?.cgBolsilloSolar && Number(contract.cgBolsilloSolar) > 0) ? (contract.cgBolsilloSolar || '0') : '0',
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
  const additionalServicesStr = Array.isArray(contract?.additionalServicesSnapshot)
    ? contract.additionalServicesSnapshot.map((s: any) => s.name).join(' - ')
    : cData.svaConcept || contract?.svaConcept || '';

  const hasAuto =
    cData.autoconsumo === 'Si' ||
    cData.autoconsumo === 'SI' ||
    cData.autoconsumo === 'Sí' ||
    cData.autoconsumo === true ||
    contract?.autoconsumo === true ||
    sp?.hasSelfConsumption === true;

  const hasSolar =
    contract?.bolsilloSolar === true ||
    (contract?.cgBolsilloSolar && Number(contract.cgBolsilloSolar) > 0);

  const annualKwh =
    contract?.annualConsumption != null
      ? String(Math.round(Number(contract.annualConsumption) * 1000))
      : sp?.annualConsumption != null
      ? String(Math.round(Number(sp.annualConsumption) * 1000))
      : cData.consumoEstimado || cData.consumoAnual || '0';

  return {
    nombretit: nombreTitular,
    '1apetit': apellido1,
    '2apetit': apellido2,
    nif: formatField(cl.vatNumber || cData.nif || cData.cif) || '',
    cnae: formatField(cData.cnae || sp.cnae || sp.sipsCnae || cl.cnae) || '',
    direcciontitular: formatField(getTitularAddress(cData)) || formatField(cl.billingAddress) || '',
    cptit: formatField(cData.cp) || dirTitObj.cp || formatField(cl.billingPostalCode) || '',
    loctit: formatField(cData.poblacion) || dirTitObj.poblacion || formatField(cl.billingCity) || '',
    provtit: formatField(cData.provincia) || dirTitObj.provincia || formatField(cl.billingProvince) || '',
    mailtitular: formatField(cl.contactEmail || cData.email) || '',
    tlftitular: formatField(cl.contactPhone || cData.telefono) || '',
    mvtitular: formatField(cl.contactPhone2 || '') || '',
    nombrerep: formatField(cl.representativeName || cData.contactoNombre) || '',
    nifrep: formatField(cl.representativeVat || cData.contactoNif) || '',
    ftraspapel: cl.paperInvoice || cData.facturasPapel === 'Si' || cData.facturasPapel === 'SI' ? 'Correo Postal' : 'Email',
    iban: formatField(contract.iban || sp.iban || cData.iban) || '',
    cups: formatField(sp.cups || cData.cups) || '',
    direccionPS: formatField(getSupplyAddress(cData)) || formatField(sp.address) || '',
    cpPS: formatField(cData.sCp || cData['Código Postal Instalación']) || dirPSObj.cp || formatField(sp.postalCode) || '',
    localidadPS: formatField(cData.sPoblacion || cData['Población Instalación']) || dirPSObj.poblacion || formatField(sp.city) || '',
    provPS: formatField(cData.sProvincia || cData['Provincia Instalación']) || dirPSObj.provincia || formatField(sp.province) || '',
    tarifa: formatField(contract.tarifa || contract.supplyPoint?.tariff || cData.tarifa || sp.sipsTariff) || '',
    p1c: formatField(contract.p1c ?? sp.p1c ?? cData.p1c ?? cData.p1) || '0',
    p2c: formatField(contract.p2c ?? sp.p2c ?? cData.p2c ?? cData.p2) || '0',
    p3c: formatField(contract.p3c ?? sp.p3c ?? cData.p3c ?? cData.p3) || '0',
    p4c: formatField(contract.p4c ?? sp.p4c ?? cData.p4c ?? cData.p4) || '0',
    p5c: formatField(contract.p5c ?? sp.p5c ?? cData.p5c ?? cData.p5) || '0',
    p6c: formatField(contract.p6c ?? sp.p6c ?? cData.p6c ?? cData.p6) || '0',
    producto: product?.name || cData.producto || '',
    nombreprod: product?.name || cData.producto || '',
    tipoprod: product?.type || contract?.pricingModel || product?.pricingModel || '',
    dsv: String(contract?.deviationCost ?? product?.deviationCost ?? cData.dsv ?? '0'),
    p1p: String(contract.p1p ?? product?.p1p ?? product?.p1 ?? cData.p1p ?? '0'),
    p2p: String(contract.p2p ?? product?.p2p ?? product?.p2 ?? cData.p2p ?? '0'),
    p3p: String(contract.p3p ?? product?.p3p ?? product?.p3 ?? cData.p3p ?? '0'),
    p4p: String(contract.p4p ?? product?.p4p ?? product?.p4 ?? cData.p4p ?? '0'),
    p5p: String(contract.p5p ?? product?.p5p ?? product?.p5 ?? cData.p5p ?? '0'),
    p6p: String(contract.p6p ?? product?.p6p ?? product?.p6 ?? cData.p6p ?? '0'),
    p1e: String(contract.p1e ?? product?.p1e ?? product?.e1 ?? cData.p1e ?? '0'),
    p2e: String(contract.p2e ?? product?.p2e ?? product?.e2 ?? cData.p2e ?? '0'),
    p3e: String(contract.p3e ?? product?.p3e ?? product?.e3 ?? cData.p3e ?? '0'),
    p4e: String(contract.p4e ?? product?.p4e ?? product?.e4 ?? cData.p4e ?? '0'),
    p5e: String(contract.p5e ?? product?.p5e ?? product?.e5 ?? cData.p5e ?? '0'),
    p6e: String(contract.p6e ?? product?.p6e ?? product?.e6 ?? cData.p6e ?? '0'),
    fee: String(contract.fee ?? product?.fee ?? cData.fee ?? '0'),
    feee: formatField(contract.svaConcept || product?.svaConcept || cData.feee) || '',
    MESESPERMANENCIA: String(contract.permanenceMonths ?? product?.permanenceMonths ?? '0'),
    servicios: additionalServicesStr,
    consumoanual: annualKwh,
    tramitacion: contract.tramitationType || cData.tipoTramitacion || cData.tramitationType || 'Cambio comercializadora sin cambios',
    modalidadauto: hasAuto ? 'Con excedentes' : 'Sin autoconsumo',
    conpexc: String(contract.feeExcedentes ?? product?.feeExcedentes ?? cData.conpexc ?? '0'),
    feeexc: String(contract.feeExcedentes ?? product?.feeExcedentes ?? cData.conpexc ?? '0'),
    pexc: String(contract.pexc ?? product?.pexc ?? cData.pexc ?? '0'),
    asociarabolsillo: hasSolar ? 'Si' : 'No',
    cbolsillosolar: hasSolar ? String(contract.cgBolsilloSolar ?? product?.cgBolsilloSolar ?? '0') : '0',
    fechafirma: contract.signatureDate
      ? new Date(contract.signatureDate).toLocaleDateString('es-ES')
      : new Date().toLocaleDateString('es-ES'),
    numcontrato: contract.contractCode || contract.id || '',
    f1: formatField(product?.f1 || cData.f1) || '',
    f2: formatField(product?.f2 || cData.f2) || '',
    f3: formatField(product?.f3 || cData.f3) || '',
    f4: formatField(product?.f4 || cData.f4) || '',
    f5: formatField(product?.f5 || cData.f5) || '',
    f6: formatField(product?.f6 || cData.f6) || '',
  };
}
