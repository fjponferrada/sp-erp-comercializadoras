import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import Airtable from 'airtable';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PRISMA_DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
  console.error("Faltan credenciales de Airtable en .env");
  process.exit(1);
}

const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);

function normalizeKey(k: string) {
  return k.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function autoMapFields(airtableFields: any, prismaModelKeys: {name: string, type: string}[]) {
  const result: any = {};
  const keyMap = new Map<string, string>();
  for (const k of Object.keys(airtableFields)) {
    keyMap.set(normalizeKey(k), k);
  }

  for (const {name, type} of prismaModelKeys) {
    const n = normalizeKey(name);
    let matchedAtKey = keyMap.get(n);
    if (!matchedAtKey && name === 'iva') matchedAtKey = keyMap.get('iva');
    if (!matchedAtKey && n.endsWith('corr')) matchedAtKey = keyMap.get(n.replace('corr', ''));

    if (matchedAtKey) {
      let val = airtableFields[matchedAtKey];
      if (Array.isArray(val) && val.length > 0 && typeof val[0] !== 'object') {
        val = val[0];
      }

      if (val !== undefined && val !== null) {
        if (type === 'Float' || type === 'Int') {
          const num = parseFloat(val.toString());
          if (!isNaN(num)) result[name] = num;
        } else if (type === 'Boolean') {
          if (typeof val === 'boolean') result[name] = val;
          else if (typeof val === 'string') result[name] = val.toUpperCase() === 'SI' || val.toUpperCase() === 'TRUE';
        } else if (type === 'DateTime') {
          const d = new Date(val);
          if (!isNaN(d.getTime())) result[name] = d;
        } else if (type === 'String') {
          result[name] = val.toString();
        }
      }
    }
  }
  return result;
}

function parseDateSafe(val: any) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const clientNewFields = [{name: 'contactVat', type: 'String'}, {name: 'contactRole', type: 'String'}, {name: 'billingStreetType', type: 'String'}, {name: 'billingStreet', type: 'String'}, {name: 'billingNumber', type: 'String'}, {name: 'billingFloor', type: 'String'}, {name: 'billingDoor', type: 'String'}, {name: 'billingCountry', type: 'String'}, {name: 'paymentTermsDays', type: 'Int'}, {name: 'clientLifeDays', type: 'Int'}];
const supplyNewFields = [{name: 'streetType', type: 'String'}, {name: 'street', type: 'String'}, {name: 'streetNumber', type: 'String'}, {name: 'floor', type: 'String'}, {name: 'door', type: 'String'}, {name: 'meteringEquipment', type: 'String'}, {name: 'boePower', type: 'Float'}, {name: 'sipsP1c', type: 'Float'}, {name: 'sipsP2c', type: 'Float'}, {name: 'sipsP3c', type: 'Float'}, {name: 'sipsP4c', type: 'Float'}, {name: 'sipsP5c', type: 'Float'}, {name: 'sipsP6c', type: 'Float'}, {name: 'pcSum', type: 'Float'}, {name: 'sipsPcSum', type: 'Float'}, {name: 'varPc', type: 'Float'},{name: 'demandaManualEne', type: 'Float'}, {name: 'demandaManualFeb', type: 'Float'}, {name: 'demandaManualMar', type: 'Float'}, {name: 'demandaManualAbr', type: 'Float'}, {name: 'demandaManualMay', type: 'Float'}, {name: 'demandaManualJun', type: 'Float'}, {name: 'demandaManualJul', type: 'Float'}, {name: 'demandaManualAgo', type: 'Float'}, {name: 'demandaManualSep', type: 'Float'}, {name: 'demandaManualOct', type: 'Float'}, {name: 'demandaManualNov', type: 'Float'}, {name: 'demandaManualDic', type: 'Float'},{name: 'excedentesManualEne', type: 'Float'}, {name: 'excedentesManualFeb', type: 'Float'}, {name: 'excedentesManualMar', type: 'Float'}, {name: 'excedentesManualAbr', type: 'Float'}, {name: 'excedentesManualMay', type: 'Float'}, {name: 'excedentesManualJun', type: 'Float'}, {name: 'excedentesManualJul', type: 'Float'}, {name: 'excedentesManualAgo', type: 'Float'}, {name: 'excedentesManualSep', type: 'Float'}, {name: 'excedentesManualOct', type: 'Float'}, {name: 'excedentesManualNov', type: 'Float'}, {name: 'excedentesManualDic', type: 'Float'}];
const contractNewFields = [{name: 'tipo', type: 'String'}, {name: 'tipoC2', type: 'String'}, {name: 'peticionClienteC2', type: 'String'}, {name: 'tipoEntrada', type: 'String'}, {name: 'fechaPrevista', type: 'DateTime'}, {name: 'captacionCliente', type: 'String'}, {name: 'autoconsumo', type: 'Boolean'}, {name: 'autoconsumoFijoIndex', type: 'String'}, {name: 'atrComer', type: 'String'}, {name: 'unPrecio', type: 'Boolean'}, {name: 'suspendido', type: 'Boolean'}, {name: 'cierre', type: 'String'}, {name: 'feeP', type: 'Float'}, {name: 'descuentoCie', type: 'Float'}, {name: 'inicioProceso', type: 'DateTime'}, {name: 'gasIncluido', type: 'Boolean'}, {name: 'bolsilloSolar', type: 'Boolean'}, {name: 'modalidadContrato', type: 'String'}, {name: 'nSolicitud', type: 'String'}, {name: 'fechaProceso', type: 'DateTime'}, {name: 'fechaAceptacion', type: 'DateTime'}, {name: 'fechaPrevistaActivacion', type: 'DateTime'}, {name: 'fechaIncidencia', type: 'DateTime'}, {name: 'sinComision', type: 'Boolean'}, {name: 'm1Activado', type: 'Boolean'}, {name: 'm1Rechazado', type: 'Boolean'}, {name: 'decomision', type: 'Float'}, {name: 'decomision50', type: 'Float'}, {name: 'comision50', type: 'Float'}, {name: 'renovacion', type: 'Boolean'}, {name: 'bajaPorM1RE1', type: 'Boolean'}, {name: 'bimensual', type: 'Boolean'}, {name: 'sinPenalizacion', type: 'Boolean'}, {name: 'sinDecomision', type: 'Boolean'}, {name: 'svaAnadidoTera', type: 'Boolean'}, {name: 'penalizacionFacturada', type: 'Boolean'}, {name: 'numFacturaPenalizacion', type: 'String'}, {name: 'facturarPen', type: 'Boolean'}, {name: 'biPen', type: 'Float'}, {name: 'ivaPen', type: 'Float'}, {name: 'penalizacionEstimada', type: 'Float'}, {name: 'abonar', type: 'Float'}, {name: 'fechaFacturaPenalizacion', type: 'DateTime'}, {name: 'ajustePen', type: 'Float'}, {name: 'productoRenovacion', type: 'String'}, {name: 'renovacionSolicitada', type: 'Boolean'}, {name: 'servicioRenovacion', type: 'String'}, {name: 'renovacionTramitada', type: 'Boolean'}, {name: 'derechosExtension', type: 'Float'}, {name: 'telegestion', type: 'Boolean'}, {name: 'estadoCompilacion', type: 'String'}, {name: 'calculoCodDistri', type: 'String'}, {name: 'nombreComercial', type: 'String'}, {name: 'ip', type: 'Float'}, {name: 'fc', type: 'Float'}, {name: 'porcComisionFijo', type: 'Float'}, {name: 'porcComisionVariable', type: 'Float'}, {name: 'ajusteConsumoComision', type: 'Float'}, {name: 'comisionAjustada', type: 'Float'}, {name: 'ajusteComisionDuracionPotencia', type: 'Float'}, {name: 'decomisionSobreAjuste', type: 'Float'}, {name: 'genContratoAuto', type: 'Boolean'}, {name: 'm1sSolicitado', type: 'Boolean'}, {name: 'm1nSolicitado', type: 'Boolean'}, {name: 'tipoPm', type: 'String'}, {name: 'calculoMesAlta', type: 'String'}, {name: 'calculoMesBaja', type: 'String'}, {name: 'mesAlta', type: 'String'}, {name: 'mesBaja', type: 'String'}, {name: 'ultimoDiaFacturado', type: 'DateTime'}, {name: 'ultDiaAFacturar', type: 'DateTime'}, {name: 'retraso', type: 'Int'}, {name: 'inicioMes0', type: 'DateTime'}, {name: 'inicioMesMinus1', type: 'DateTime'}, {name: 'finMesMinus1', type: 'DateTime'}, {name: 'energiaPteMesMinus1', type: 'Float'}, {name: 'inicioMesMinus2', type: 'DateTime'}, {name: 'finMesMinus2', type: 'DateTime'}, {name: 'energiaPteMesMinus2', type: 'Float'}, {name: 'energiaPteMes0HastaHoy', type: 'Float'}, {name: 'finMes0', type: 'DateTime'}, {name: 'ultDiaFact', type: 'DateTime'}, {name: 'energiaPteMes0HastaFinMes', type: 'Float'}, {name: 'transferencia', type: 'Boolean'}, {name: 'firmaManRenov', type: 'Boolean'}, {name: 'consumoRealEstimado', type: 'String'}, {name: 'pen20TdResid', type: 'Float'}, {name: 'penNoResid', type: 'Float'}, {name: 'pen20TdResidHoy', type: 'Float'}, {name: 'horasUsoDiarios', type: 'Float'}, {name: 'tipoEnvioFacturaRenov', type: 'String'}, {name: 'diasContrato', type: 'Int'}, {name: 'diasRenovMax', type: 'Int'}, {name: 'estadoPrevio', type: 'String'}, {name: 'fechaVencimientoCalculada', type: 'DateTime'}];
const invoiceNewFieldsStr = `path String, minimoImporteIESuperado String, claseFactura String, codigoFiscal String, cupsCode String, duracion Int, fijoIndex String, p1c Float, p2c Float, p3c Float, p4c Float, p5c Float, p6c Float, p1PotenciaContratada Float, p2PotenciaContratada Float, p3PotenciaContratada Float, p4PotenciaContratada Float, p5PotenciaContratada Float, p6PotenciaContratada Float, p1PotenciaMaxDemanda Float, p2PotenciaMaxDemanda Float, p3PotenciaMaxDemanda Float, p4PotenciaMaxDemanda Float, p5PotenciaMaxDemanda Float, p6PotenciaMaxDemanda Float, p1EnergiaActivaConsumida Float, p2EnergiaActivaConsumida Float, p3EnergiaActivaConsumida Float, p4EnergiaActivaConsumida Float, p5EnergiaActivaConsumida Float, p6EnergiaActivaConsumida Float, energiaReactivaTotalConsumida Float, p1EnergiaReactivaConsumida Float, p2EnergiaReactivaConsumida Float, p3EnergiaReactivaConsumida Float, p4EnergiaReactivaConsumida Float, p5EnergiaReactivaConsumida Float, p6EnergiaReactivaConsumida Float, p1PrecioEnergiaReactiva Float, p2PrecioEnergiaReactiva Float, p3PrecioEnergiaReactiva Float, p4PrecioEnergiaReactiva Float, p5PrecioEnergiaReactiva Float, p6PrecioEnergiaReactiva Float, penalizacionNoIcp Float, porcentajePerdidas Float, potenciaAFacturarP1 Float, potenciaAFacturarP2 Float, potenciaAFacturarP3 Float, potenciaAFacturarP4 Float, potenciaAFacturarP5 Float, potenciaAFacturarP6 Float, excedentesP1Autoconsumo Float, excedentesP2Autoconsumo Float, excedentesP3Autoconsumo Float, excedentesP4Autoconsumo Float, excedentesP5Autoconsumo Float, excedentesP6Autoconsumo Float, excedentesAutoconsumoAFacturar Float, importeAeP1 Float, importeAeP2 Float, importeAeP3 Float, importeAeP4 Float, importeAeP5 Float, importeAeP6 Float, importeTotalAeAtr Float, importePmP1 Float, importePmP2 Float, importePmP3 Float, importePmP4 Float, importePmP5 Float, importePmP6 Float, importeTotalPmAtr Float, importeExcesoPmP1 Float, importeExcesoPmP2 Float, importeExcesoPmP3 Float, importeExcesoPmP4 Float, importeExcesoPmP5 Float, importeExcesoPmP6 Float, importeTotalExcesosAtr Float, importeR1P1 Float, importeR1P2 Float, importeR1P3 Float, importeR1P4 Float, importeR1P5 Float, importeR1P6 Float, importeTotalRAtr Float, importeExcedentesAutoconsumo Float, suplementoTerritorial Float, subtotal2 Float, conceptoRepercutible Float, subtotalOtrosConcepto Float, baseImponibleIva Float, iva Float, importeIva Float, total Float, disponibilidadLectura Float, precioDiaAlquiler1 Float, numeroDiasAlquiler1 Int, precioDiaAlquiler2 Float, numeroDiasAlquiler2 Int, precioDiaAlquiler3 Float, numeroDiasAlquiler3 Int, precioDiaAlquiler4 Float, numeroDiasAlquiler4 Int, importeIndemnizacion Float, alquilerEquipoDeMedida Float, ieOdoo Float, mostrarWeb Boolean, conceptoRepercutible1 String, udsConceptoRepercutible1 Float, precioConceptoRepercutible1 Float, importeConceptoRepercutible1 Float, conceptoRepercutible2 String, udsConceptoRepercutible2 Float, precioConceptoRepercutible2 Float, importeConceptoRepercutible2 Float, conceptoRepercutible3 String, udsConceptoRepercutible3 Float, precioConceptoRepercutible3 Float, importeConceptoRepercutible3 Float, conceptoSva String, costesDeGestion Float, importeCargoPotenciaTotal Float, importeCargoEnergiaTotal Float, totalImporteCargos Float, totalImportePeajes Float, baseImponibleF1 Float, baseImponible0 Float, baseImponible10 Float, importeIva10 Float, baseImponible21 Float, importeIva21 Float, importeTotalExcesosAtrF1 Float, fee Float, dsv Float, p1pm Float, p2pm Float, p3pm Float, p4pm Float, p5pm Float, p6pm Float, importePeajesAe Float, importePeajesPm Float, base560 Float, importeBonoSocial Float, importePotenciaFactura Float, importePotenciaAtr Float, margenPotencia Float, margenExcesos Float, importeEnergiaFactura Float, importeEnergiaSinMargen Float, margenEnergia Float, margenFactura Float, comisionPotenciaCanal Float, comisionPrecioEnergia Float, comisionVolumenEnergia Float, facturado Boolean, importeAjusteGas Float, baseImponible5 Float, importeIva5 Float, gasIncluido Boolean, importeEnergiaAtr Float, importeAplicableCompensacionExcedentes Float, importeExcedentesAutoconsumoAplicado Float, bolsilloSolar Boolean, inicioBolsilloSolar DateTime, cargaBolsilloSolar Float, costesDeGestionBolsilloSolar Float, descuentoBolsilloSolar Float, importeAlmacenadoBolsilloSolar Float, comisionCostesDeGestion Float, comisionGapAutoconsumo Float, sistemaElectrico Float, propiedadExcedentes Float, comisionImporteExcedentario Float, numeroFacturaPdf String, comunicar Boolean, nombreCompleto String, emailEnvioFactura String, formaEnvioFactura String, numeroFacturaRectificadaRef String, fechaFacturaRectificadaRef DateTime, importeFacturaRectificadaRef Float, precioUnitarioSva Float, diasSva Int, totalSva Float, importeDevolucion Float, cg Float, p1em Float, p2em Float, p3em Float, p4em Float, p5em Float, p6em Float, codigoFacturaRectificadaAnulada String, importeAhorroCargos Float, porcentajeReduccionCargos Float, mailEnviado Boolean, numeroFacturaXml String, comisionSemiindexadoAnual Float, comisionPrecioFijoEnergia Float, correoPostalEnviado Boolean, recargoInfAnio Float, tipoAutoconsumoDistribuidora String, gapAutoconsumo Float, derechosGarantia Float, dsvm Float, feem Float, cgm Float, unidadesMix Float, precioMix Float, pExcedentes Float, importePenalizaciones Float, omiePromedioMah Float, baseImponibleAyuntamiento Float, tasaMunicipalForm Float, totalSinDescuento Float, codigoRee String, importeTotalCoberturas Float, comisionTotal Float, estadoContrato String, domicilioTitular String, recordatorioVtoFtra Boolean, nombreCompletoTitular String, baseImponibleTasaMunicipal Float, tasaMunicipal Float, avisoTransfPagoFtra Boolean, telefonoContacto String, diasCorr Int, totalCorr Float, totalSoftr Float, excTotal Float, mesAno String, calculoMesAno String, baseImponibleIvaCorr Float, facturaRectificada Boolean, margenFtraRectificada Float, margenEstimado Float, importeImpuestoCorr Float, baseImponibleF1Corr Float, margenRelIngebau Float, margenFacturaDashboard Float, margenFacturaCorr Float, importeBonoSocialCorr Float, subidaFace Boolean`;
const invoiceNewFields = invoiceNewFieldsStr.split(', ').map(s => { const [name, type] = s.split(' '); return {name, type}; });

async function run() {
  console.log("Iniciando WIPE y MIGRACIÓN MASIVA TOTAL de contratos de Airtable...");

  await prisma.invoice.deleteMany();
  await prisma.commission.deleteMany();
  await prisma.contractModification.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.document.deleteMany();
  await prisma.contract.deleteMany();
  await prisma.supplyPoint.deleteMany();
  await prisma.client.deleteMany();
  await prisma.product.deleteMany();
  await prisma.channel.deleteMany();
  await prisma.user.deleteMany({ where: { email: { not: 'fjponferrada@sp-energia.com' } } });
  console.log("✅ Tablas limpiadas.");

  let company = await prisma.company.upsert({
    where: { codigo: 'AED' },
    update: {},
    create: { name: 'AED Energía', cif: 'B12345678', codigo: 'AED' }
  });

  let brand = await prisma.brand.upsert({
    where: { slug: 'aed-energia' },
    update: {},
    create: { name: 'AED Energía', slug: 'aed-energia', companyId: company.id, codigoMarca: 'AED' }
  });

  let superAdmin = await prisma.user.upsert({
    where: { email: 'fjponferrada@sp-energia.com' },
    update: {},
    create: { name: 'Admin', email: 'fjponferrada@sp-energia.com', password: 'pwd', role: 'SUPERADMIN', brandId: brand.id }
  });

  console.log("Descargando TODOS los contratos...");
  const contractsRecord = await base('CONTRATOS').select().all();
  const contracts = contractsRecord.map(r => ({ id: r.id, fields: r.fields as any }));
  console.log(`✅ Obtenidos ${contracts.length} contratos totales.`);

  const clientIds = new Set<string>();
  const supplyIds = new Set<string>();
  const invoiceIds = new Set<string>();
  const userIds = new Set<string>();
  const contractCodes: string[] = [];

  for (const c of contracts) {
    const f = c.fields;
    if (f['CIF link']) clientIds.add(f['CIF link'][0]);
    if (f['INSTALACIONES_LINK']) supplyIds.add(f['INSTALACIONES_LINK'][0]);
    if (f['FACTURAS']) f['FACTURAS'].forEach((id: string) => invoiceIds.add(id));
    if (f['CONTRATO']) contractCodes.push(f['CONTRATO']);
    if (f['Comercial']) f['Comercial'].forEach((id: string) => userIds.add(id));
  }

  console.log(`Descargando ${clientIds.size} clientes, ${supplyIds.size} instalaciones, ${invoiceIds.size} facturas...`);

  const airtableClients = await fetchChunks('CLIENTES', Array.from(clientIds));
  const airtableSupplies = await fetchChunks('INSTALACIONES', Array.from(supplyIds));
  const airtableInvoices = await fetchChunks('FACTURAS', Array.from(invoiceIds));
  const airtableUsuarios = await fetchChunks('USUARIOS', Array.from(userIds));

  const clientsMap = new Map(airtableClients.map(c => [c.id, c.fields]));
  const suppliesMap = new Map(airtableSupplies.map(s => [s.id, s.fields]));
  const invoicesMap = new Map(airtableInvoices.map(i => [i.id, i.fields]));
  const usuariosMap = new Map(airtableUsuarios.map(u => [u.id, u.fields]));
  
  const leadsByContract = new Map<string, any>();
  const airtableLeads = await fetchLeadsByContracts(contractCodes);
  for (const l of airtableLeads) {
     if (l.fields['CONTRATO']) {
         leadsByContract.set(l.fields['CONTRATO'], { id: l.id, fields: l.fields });
     }
  }

  console.log(`✅ Dependencias descargadas. Iniciando inyección en PostgreSQL (${contracts.length} contratos)...`);

  let count = 0;
  for (const record of contracts) {
    count++;
    if (count % 50 === 0) console.log(`Procesando contrato ${count} / ${contracts.length}...`);
    
    const f = record.fields;
    const contractCode = f['CONTRATO'] || `CC_${record.id}`;
    const createdAtStr = f['Fecha Registro'] || f['Fecha Solicitud'] || new Date().toISOString();
    const createdAt = parseDateSafe(createdAtStr) || new Date();

    // Process Commercial (User) and Channel
    let emailsToTry = [f['Email Comercial'], f['Email Gerente'], f['Email Sup Canal'], f['Email Admin Canal'], f['Email AtCliente']].flat().filter(Boolean);
    let comercialEmailStr = emailsToTry.length > 0 ? emailsToTry[0] : null;
    let comercialEmail = comercialEmailStr || superAdmin.email;
    let fallbackName = comercialEmail.split('@')[0];
    
    let comercialName = fallbackName;
    let comercialCodigo = null;
    let comercialPhone = null;
    let isSupervisor = false;

    const comercialRecordId = (f['Comercial'] && Array.isArray(f['Comercial'])) ? f['Comercial'][0] : null;
    if (comercialRecordId) {
        const uFields = usuariosMap.get(comercialRecordId);
        if (uFields) {
            if (uFields['Nombre2']) comercialName = uFields['Nombre2'].toString();
            if (uFields['Código']) comercialCodigo = uFields['Código'].toString();
            if (uFields['Teléfono']) comercialPhone = uFields['Teléfono'].toString();
            if (uFields['Supervisor canal'] === true || uFields['Supervisor canal'] === 'true') isSupervisor = true;
        }
    }
    
    let user = await prisma.user.findFirst({ where: { email: comercialEmail } });
    if (!user) {
        user = await prisma.user.create({ data: { 
            name: comercialName, 
            email: comercialEmail, 
            password: 'pwd', 
            brandId: brand.id,
            codigo: comercialCodigo,
            phone: comercialPhone,
            isChannelSupervisor: isSupervisor
        } });
    }
    
    let canalName = (f['CANAL'] && Array.isArray(f['CANAL'])) ? f['CANAL'][0] : (f['CANAL'] || 'Directo').toString();
    let channel = await prisma.channel.findFirst({ where: { name: canalName } });
    if (!channel) {
        channel = await prisma.channel.create({ data: { name: canalName, code: canalName.replace(/[^A-Z0-9]/ig, '').toUpperCase().substring(0, 10) } });
    }
    
    if (!user.channelId) {
        await prisma.user.update({ where: { id: user.id }, data: { channelId: channel.id } });
    }

    // Process Client
    let clientRecordId = f['CIF link'] ? f['CIF link'][0] : null;
    let cf: any = clientRecordId ? clientsMap.get(clientRecordId) : null;
    if (!cf) cf = f;

    const businessName = (cf['Nombre completo Titular'] || f['Nombre completo Titular'] || cf['NOMBRERAZON SOCIAL'] || cf['Nombre completo'] || cf['Nombre / Razón social Titular'] || cf['Nombre/Razón Social'] || cf['NOMBRE Y APELLIDOS'] || 'Desconocido').toString().trim();
    
    const clientTypeStr = (cf['Tipo de persona'] && Array.isArray(cf['Tipo de persona'])) ? cf['Tipo de persona'][0] : (cf['Tipo de persona'] || '');
    function getFirst(val: any) {
      if (Array.isArray(val)) return val[0];
      return val;
    }
    const rawCif = getFirst(cf['CIF']) || getFirst(f['CIF']) || getFirst(cf['Copia de CIF link']) || getFirst(f['Copia de CIF link']);
    const rawNif = getFirst(cf['NIF Titular']) || getFirst(cf['DNI/NIF Titular']) || getFirst(cf['NIF']) || getFirst(cf['NIF Contacto']);
    
    let clientType = 'Física';
    const bLower = businessName.toLowerCase();
    if (
      clientTypeStr.toLowerCase().includes('jur') || 
      clientTypeStr.toLowerCase().includes('empresa') || 
      bLower.includes(' s.l') || bLower.includes(' s.a') || bLower.includes(' slu') || 
      bLower.includes(' coop') || bLower.includes('reciclaje') || bLower.includes('ayuntamiento') || 
      bLower.includes('arquitecto') || bLower.includes('comunidad de') || bLower.includes('c.b') || 
      bLower.includes('s.c')
    ) {
      clientType = 'Jurídica';
    } else {
      const nifStr = (rawNif || rawCif || '').toString().trim();
      const firstChar = nifStr.charAt(0).toUpperCase();
      if (firstChar >= 'A' && firstChar <= 'W' && firstChar !== 'X' && firstChar !== 'Y') {
        clientType = 'Jurídica';
      }
    }

    let vatNumber = '';
    if (clientType === 'Jurídica') {
        if (rawCif) vatNumber = rawCif;
        else if (rawNif && rawNif.toString().match(/^[A-W]/i)) vatNumber = rawNif;
        else vatNumber = `UNKNOWN_CIF_${record.id}`;
    } else {
        vatNumber = (rawNif || rawCif || `UNKNOWN_${record.id}`);
    }
    vatNumber = vatNumber.toString().trim();

    let client = null;
    if (clientRecordId) client = await prisma.client.findUnique({ where: { airtableId: clientRecordId } });
    if (!client) client = await prisma.client.findFirst({ where: { vatNumber } });

    if (!client) {
      const extraFields = autoMapFields(cf, clientNewFields);
      client = await prisma.client.create({
        data: {
          vatNumber,
          businessName,
          firstName: (cf['Primer apellido Titular'] || cf['Primer Apellido'] || null)?.toString(),
          lastName: (cf['Segundo apellido Titular'] || cf['Segundo Apellido'] || null)?.toString(),
          clientType,
          contactEmail: cf['Email'] || f['EMAIL'] || 'test@test.com',
          contactPhone: cf['Teléfono'] || f['TLF'] || '000000000',
          brandId: brand.id,
          airtableId: clientRecordId,
          createdAt,
          iban: (cf['IBAN'] || f['IBAN'] || null)?.toString(),
          paymentMethod: (cf['Forma de pago'] || f['Forma de pago'] || null)?.toString(),
          paperInvoice: (cf['Factura en papel'] || f['Factura en papel'] || f['¿Facturas papel?'] || false) ? true : false,
          ...extraFields
        }
      });
    }

    // Process Supply Point
    let supplyRecordId = f['INSTALACIONES_LINK'] ? f['INSTALACIONES_LINK'][0] : null;
    let sf: any = supplyRecordId ? suppliesMap.get(supplyRecordId) : null;
    if (!sf) sf = f;

    const cups = (sf['CUPS'] || f['CUPS'] || `CUPS_${record.id}`).toString().trim();
    let supply = null;
    if (supplyRecordId) supply = await prisma.supplyPoint.findUnique({ where: { airtableId: supplyRecordId } });
    if (!supply) {
        supply = await prisma.supplyPoint.findFirst({ where: { cups, clientId: client.id } });
    } if (!supply) {
      const extraFields = autoMapFields(sf, supplyNewFields);
      supply = await prisma.supplyPoint.create({
        data: {
          cups,
          address: (sf['DOMICILIO PS COMPLETO'] || f['DOMICILIO PS COMPLETO'] || f['Calle Instalación'] || 'Desconocida').toString(),
          city: (sf['Población Instalación'] || f['Población Instalación'] || 'Desconocida').toString(),
          postalCode: (sf['Código Postal Instalación'] || f['Código Postal Instalación'] || '00000').toString(),
          province: (sf['Provincia Instalación'] || f['Provincia Instalación'] || 'Desconocida').toString(),
          tariff: (sf['Tarifa'] || f['Tarifa'] || '2.0TD').toString(),
          annualConsumption: (parseFloat(sf['CONSUMO ANUAL KWH']) || parseFloat(f['CONSUMO ANUAL KWH']) || 0),
          p1p: sf['P1P'] ? parseFloat(sf['P1P']) : f['P1P'] ? parseFloat(f['P1P']) : null,
          p2p: sf['P2P'] ? parseFloat(sf['P2P']) : f['P2P'] ? parseFloat(f['P2P']) : null,
          p3p: sf['P3P'] ? parseFloat(sf['P3P']) : f['P3P'] ? parseFloat(f['P3P']) : null,
          p4p: sf['P4P'] ? parseFloat(sf['P4P']) : f['P4P'] ? parseFloat(f['P4P']) : null,
          p5p: sf['P5P'] ? parseFloat(sf['P5P']) : f['P5P'] ? parseFloat(f['P5P']) : null,
          p6p: sf['P6P'] ? parseFloat(sf['P6P']) : f['P6P'] ? parseFloat(f['P6P']) : null,
          p1c: sf['P1C'] ? parseFloat(sf['P1C']) : f['P1C'] ? parseFloat(f['P1C']) : null,
          p2c: sf['P2C'] ? parseFloat(sf['P2C']) : f['P2C'] ? parseFloat(f['P2C']) : null,
          p3c: sf['P3C'] ? parseFloat(sf['P3C']) : f['P3C'] ? parseFloat(f['P3C']) : null,
          p4c: sf['P4C'] ? parseFloat(sf['P4C']) : f['P4C'] ? parseFloat(f['P4C']) : null,
          p5c: sf['P5C'] ? parseFloat(sf['P5C']) : f['P5C'] ? parseFloat(f['P5C']) : null,
          p6c: sf['P6C'] ? parseFloat(sf['P6C']) : f['P6C'] ? parseFloat(f['P6C']) : null,
          cadastralReference: (sf['REFERENCIA CATASTRAL'] || f['REFERENCIA CATASTRAL'] || sf['Referencia Catastral'] || f['Referencia Catastral'] || null)?.toString(),
          cadastreProvince: (sf['Provincia Catastro'] || f['Provincia Catastro'] || null)?.toString(),
          cadastreCity: (sf['Municipio Catastro'] || f['Municipio Catastro'] || null)?.toString(),
          cadastreStreetType: (sf['Tipo de vía Catastro'] || f['Tipo de vía Catastro'] || null)?.toString(),
          cadastreAddress: (sf['Nombre Vía Catastro'] || f['Nombre Vía Catastro'] || sf['Dirección Catastro'] || null)?.toString(),
          cadastreNumber: (sf['Número Catastro'] || f['Número Catastro'] || sf['Número'] || null)?.toString(),
          cadastreBlock: (sf['Bloque Catastro'] || f['Bloque Catastro'] || sf['Bloque'] || null)?.toString(),
          cadastreFloor: (sf['Planta Catastro'] || f['Planta Catastro'] || sf['Planta'] || null)?.toString(),
          cadastreDoor: (sf['Puerta Catastro'] || f['Puerta Catastro'] || sf['Puerta'] || null)?.toString(),
          cau: (sf['CAU'] || f['CAU'] || null)?.toString(),
          cauType: (sf['Tipo de autoconsumo'] || f['Tipo de autoconsumo'] || null)?.toString(),
          cauSubtype: (sf['Subtipo de autoconsumo'] || f['Subtipo de autoconsumo'] || null)?.toString(),
          cauCollective: (sf['Colectivo'] || f['Colectivo'] || null)?.toString(),
          cil: (sf['CIL'] || f['CIL'] || null)?.toString(),
          cie: (sf['CIE'] || f['CIE'] || sf['CIE Consumo'] || f['CIE Consumo'] || null)?.toString(),
          cieSelfConsumption: (sf['CIE autoconsumo'] || f['CIE autoconsumo'] || null)?.toString(),
          generatorTechnology: (sf['Tecnología del generador'] || f['Tecnología del generador'] || null)?.toString(),
          installedPowerGen: sf['Potencia instalada de generación'] ? parseFloat(sf['Potencia instalada de generación']) : f['Potencia instalada de generación'] ? parseFloat(f['Potencia instalada de generación']) : null,
          installationType: (sf['Tipo de instalación'] || f['Tipo de instalación'] || null)?.toString(),
          meteringScheme: (sf['Esquema de medida'] || f['Esquema de medida'] || null)?.toString(),
          distributorReeCode: (sf['Cód de Distribuidora REE'] || f['Cód de Distribuidora REE'] || null)?.toString(),
          distributorName: (sf['Distribuidora'] || f['Distribuidora'] || null)?.toString(),
          hasSelfConsumption: (sf['CAU'] || f['CAU'] || sf['Tipo de autoconsumo'] || f['Tipo de autoconsumo']) ? true : false,
          clientId: client.id,
          airtableId: supplyRecordId,
          ...extraFields
        }
      });
    }

    const productName = (f['Producto y Servicio'] && Array.isArray(f['Producto y Servicio'])) ? f['Producto y Servicio'][0] : (f['Producto y Servicio'] || 'Prod');
    let product = await prisma.product.findFirst({ where: { name: productName } });
    if (!product) product = await prisma.product.create({ data: { name: productName, type: 'FIX', brandId: brand.id } });

    // Process Contract
    const extraContractFields = autoMapFields(f, contractNewFields);
    let contract = await prisma.contract.findUnique({ where: { airtableId: record.id } });
    if (!contract) {
      contract = await prisma.contract.create({
        data: {
          airtableId: record.id,
          contractCode,
          status: (f['Estado'] || f['Estado CONTRATO'] || 'ACTIVO').toString().toUpperCase(),
          clientId: client.id,
          supplyPointId: supply.id,
          productId: product.id,
          userId: user.id,
          activationDate: parseDateSafe(f['ALTA COMERCIALIZADORA'] || f['FECHA INICIO SVA'] || f['Inicio Mes 0']),
          permanenceStartDate: parseDateSafe(f['INICIO_PERMANENCIA']),
          expectedEndDate: parseDateSafe(f['Fecha Vencimiento Calculada']),
          terminationDate: parseDateSafe(f['BAJA COMERCIALIZADORA']),
          signatureDate: parseDateSafe(f['Fecha firma contrato'] || f['Fecha firma']),
          internalComments: f['Observaciones'] ? String(f['Observaciones']) : null,
          customP1E: f['P1E'] ? parseFloat(f['P1E']) : null,
          customP2E: f['P2E'] ? parseFloat(f['P2E']) : null,
          customP3E: f['P3E'] ? parseFloat(f['P3E']) : null,
          customP4E: f['P4E'] ? parseFloat(f['P4E']) : null,
          customP5E: f['P5E'] ? parseFloat(f['P5E']) : null,
          customP6E: f['P6E'] ? parseFloat(f['P6E']) : null,
          customP1P: f['P1P'] ? parseFloat(f['P1P']) : null,
          customP2P: f['P2P'] ? parseFloat(f['P2P']) : null,
          customP3P: f['P3P'] ? parseFloat(f['P3P']) : null,
          customP4P: f['P4P'] ? parseFloat(f['P4P']) : null,
          customP5P: f['P5P'] ? parseFloat(f['P5P']) : null,
          customP6P: f['P6P'] ? parseFloat(f['P6P']) : null,
          customP1C: f['P1C'] ? parseFloat(f['P1C']) : null,
          customP2C: f['P2C'] ? parseFloat(f['P2C']) : null,
          customP3C: f['P3C'] ? parseFloat(f['P3C']) : null,
          customP4C: f['P4C'] ? parseFloat(f['P4C']) : null,
          customP5C: f['P5C'] ? parseFloat(f['P5C']) : null,
          customP6C: f['P6C'] ? parseFloat(f['P6C']) : null,
          customFee: (f['Fee Index'] || f['Fee/MWh'] || f['Fee / Margen Comercial']) ? parseFloat(f['Fee Index'] || f['Fee/MWh'] || f['Fee / Margen Comercial']) : null,
          customDeviationCost: f['Coste Desvíos'] ? parseFloat(f['Coste Desvíos']) : null,
          customCGBolsilloSolar: f['CG Bolsillo Solar'] ? parseFloat(f['CG Bolsillo Solar']) : null,
          customPExc: f['Precio Excedentes'] ? parseFloat(f['Precio Excedentes']) : null,
          svaConcept: (f['Concepto SVA'] || null)?.toString(),
          svaPrice: f['Precio SVA'] ? parseFloat(f['Precio SVA']) : null,
          svaDuration: f['Duración SVA (Meses)'] ? parseInt(f['Duración SVA (Meses)']) : null,
          svaStartDate: parseDateSafe(f['Fecha Inicio SVA']),
          commissionBase: f['Comisión Estimada'] ? parseFloat(f['Comisión Estimada']) : null,
          commissionFinal: f['Comisión Final'] ? parseFloat(f['Comisión Final']) : null,
          discountPrice: f['Descuento (€)'] ? parseFloat(f['Descuento (€)']) : null,
          discountStartDate: parseDateSafe(f['Fecha Inicio Descuento']),
          discountEndDate: parseDateSafe(f['Fecha Fin Descuento']),
          createdAt,
          ...extraContractFields
        }
      });
    }

    // Process Lead
    const leadData = leadsByContract.get(contractCode);
    if (leadData || true) {
        let lead = await prisma.lead.findUnique({ where: { contractId: contract.id } });
        if (!lead) {
            const lf = leadData ? leadData.fields : f;
            await prisma.lead.create({
                data: {
                    airtableId: leadData ? leadData.id : `L_${contract.id}`,
                    businessName: client.businessName,
                    vatNumber: client.vatNumber,
                    email: client.contactEmail,
                    phone: client.contactPhone,
                    status: 'FIRMADO',
                    type: 'LUZ',
                    source: canalName,
                    cups: supply.cups,
                    contractId: contract.id,
                    userId: user.id,
                    createdAt: parseDateSafe(lf['Fecha Registro']) || createdAt,
                    
                    contractData: {
                      titularStreetType: lf['Tipo de vía Titular']?.toString(),
                      titularStreet: lf['Calle Titular']?.toString(),
                      titularNumber: lf['Número Titular']?.toString(),
                      titularPostalCode: lf['Código postal Titular']?.toString(),
                      titularCity: lf['Población Titular']?.toString(),
                      titularProvince: lf['Provincia Titular']?.toString(),
                      
                      supplyStreetType: lf['Tipo de vía Instalación']?.toString(),
                      supplyStreet: lf['Calle Instalación']?.toString(),
                      supplyNumber: lf['Número Instalación']?.toString(),
                      supplyPostalCode: lf['Código Postal Instalación']?.toString(),
                      supplyCity: lf['Población Instalación']?.toString(),
                      supplyProvince: lf['Provincia Instalación']?.toString(),

                      contactName: lf['Nombre Contacto']?.toString(),
                      contactLastName: lf['Apellidos Contacto']?.toString(),
                      contactRole: lf['EN CALIDAD DE']?.toString(),

                      iban: lf['IBAN']?.toString(),
                      paymentMethod: lf['Forma de pago']?.toString(),
                      paperInvoice: lf['Factura en papel'] ? true : false,
                      invoiceDelivery: lf['Envío de factura']?.toString(),
                      tramitationType: lf['Tramitación a realizar']?.toString(),
                      mandateDouble: lf['MANDATO DOBLE'] === 'SI' ? true : false,
                    },
                }
            });
        }
    }

    // Process Invoices
    const invIds = f['FACTURAS'] || [];
    for (const invId of invIds) {
      const invf = invoicesMap.get(invId) as any;
      if (!invf) continue;

      const invoiceNumber = (invf['Numero Factura'] || invf['N Factura'] || invf['Número Factura'] || `INV_${invId}`).toString();
      let inv = await prisma.invoice.findFirst({ where: { invoiceNumber } });
      if (!inv) {
        const extraInvFields = autoMapFields(invf, invoiceNewFields);
        await prisma.invoice.create({
          data: {
            invoiceNumber,
            clientId: client.id,
            companyId: brand.companyId,
            supplyPointId: supply.id,
            contractId: contract.id,
            issueDate: parseDateSafe(invf['Fecha Factura'] || invf['Fecha']) || new Date(),
            billingStart: parseDateSafe(invf['Desde'] || invf['Desde(P)']),
            billingEnd: parseDateSafe(invf['Hasta'] || invf['Hasta(P)']),
            origin: (invf['Procedencia'] || invf['Procedencia Desde'] || invf['Origen'] || '').toString(),
            totalAmount: parseFloat(invf['Total']) || parseFloat(invf['TOTAL']) || 0,
            totalMWh: parseFloat(invf['Cantidad Energía Total Consumida']) || parseFloat(invf['Energía Total Consumida']) || parseFloat(invf['Consumo']) || 0,
            createdAt: parseDateSafe(invf['Fecha Registro']) || new Date(),
            ...extraInvFields
          }
        });
      }
    }
  }

  console.log("¡MIGRACIÓN MASIVA FINALIZADA CON ÉXITO!");
}

async function fetchChunks(table: string, ids: string[]): Promise<any[]> {
    if (ids.length === 0) return [];
    let allRecords: any[] = [];
    for (let i = 0; i < ids.length; i += 10) {
      const chunk = ids.slice(i, i + 10);
      const filter = `OR(${chunk.map(id => `RECORD_ID()="${id}"`).join(',')})`;
      const records = await base(table).select({ filterByFormula: filter }).all();
      allRecords = allRecords.concat(records.map(r => ({ id: r.id, fields: r.fields })));
      // Rate limiting: max 5 requests per second for Airtable
      await sleep(250); 
    }
    return allRecords;
}

async function fetchLeadsByContracts(codes: string[]): Promise<any[]> {
    if (codes.length === 0) return [];
    let allRecords: any[] = [];
    for (let i = 0; i < codes.length; i += 10) {
      const chunk = codes.slice(i, i + 10);
      const filter = `OR(${chunk.map(c => `CONTRATO="${c}"`).join(',')})`;
      const records = await base('LEADS').select({ filterByFormula: filter }).all();
      allRecords = allRecords.concat(records.map(r => ({ id: r.id, fields: r.fields })));
      await sleep(250);
    }
    return allRecords;
}

run().catch(e => {
  console.error("Fatal Error:", e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
