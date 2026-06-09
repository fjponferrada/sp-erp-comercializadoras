require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const xlsx = require('xlsx');
const path = require('path');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = process.env.AIRTABLE_BASE_ID || 'appDimkTx3UGQ678C';

if (!API_KEY) {
    console.error("Falta AIRTABLE_API_KEY en .env");
    process.exit(1);
}

const docsDir = path.join('C:', 'Users', 'Administrator', 'sp-erp-comercializadoras', 'docs');
const dicts = {
    'CONTRATOS': 'diccionario_contratos.xlsx',
    'CLIENTES': 'diccionario_clientes.xlsx',
    'LEADS': 'diccionario_leads.xlsx',
    'INSTALACIONES': 'diccionario_instalaciones.xlsx',
    'FACTURAS': 'diccionario_facturas.xlsx',
    'PRODUCTOS': 'diccionario_productos.xlsx'
};

const mappings = {}; 

for (const [table, file] of Object.entries(dicts)) {
    mappings[table] = {};
    const filePath = path.join(docsDir, file);
    if (require('fs').existsSync(filePath)) {
        const wb = xlsx.readFile(filePath);
        const data = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        data.forEach(row => {
            const airtableName = row['Nombre Airtable'];
            const pgField = row['Campo Equivalente PostgreSQL'];
            if (pgField && !pgField.includes('Ignorado') && !pgField.includes('No mapeado') && !pgField.includes('Por determinar')) {
                mappings[table][airtableName] = pgField;
            }
        });
    }
}

async function fetchAirtable(table, recordId = null, params = '') {
    const url = recordId 
        ? 'https://api.airtable.com/v0/' + BASE_ID + '/' + encodeURIComponent(table) + '/' + recordId
        : 'https://api.airtable.com/v0/' + BASE_ID + '/' + encodeURIComponent(table) + '?' + params;
    
    const res = await fetch(url, {
        headers: { 'Authorization': 'Bearer ' + API_KEY }
    });
    if (!res.ok) {
        console.error('Airtable error fetching ' + table + ' ' + (recordId||''), await res.text());
        return null;
    }
    return await res.json();
}

const { Prisma } = require('@prisma/client');
const dmmfModels = Prisma.dmmf.datamodel.models;

function mapRecordToPrisma(table, record, targetModel) {
    const fields = record.fields || {};
    const result = {};
    const relations = {};
    const modelMeta = dmmfModels.find(m => m.name.toLowerCase() === targetModel.toLowerCase());

    for (const [key, value] of Object.entries(fields)) {
        if (Array.isArray(value) && typeof value[0] === 'string' && value[0].startsWith('rec')) {
            relations[key] = value;
            continue;
        }
        if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && value[0].url) {
            relations[`_doc_${key}`] = value;
            continue;
        }

        const pgMapping = mappings[table][key];
        if (pgMapping) {
            const mapParts = pgMapping.split(' / ');
            for (let part of mapParts) {
                part = part.trim();
                if (part.toLowerCase().startsWith(targetModel.toLowerCase() + '.')) {
                    const prop = part.split('.')[1];
                    let cleanValue = value;
                    if (Array.isArray(value) && value.length === 1 && typeof value[0] === 'string' && !value[0].startsWith('rec')) {
                        cleanValue = value[0];
                    }
                    if (Array.isArray(value)) {
                        cleanValue = value.join(', ');
                    }
                    
                    if (modelMeta) {
                        const fieldMeta = modelMeta.fields.find(f => f.name.toLowerCase() === prop.toLowerCase());
                        if (fieldMeta) {
                            const trueProp = fieldMeta.name;
                            if (cleanValue !== null && cleanValue !== undefined) {
                                if (fieldMeta.type === 'String') cleanValue = String(cleanValue);
                                if (fieldMeta.type === 'Float') {
                                    cleanValue = parseFloat(cleanValue);
                                    if (isNaN(cleanValue)) cleanValue = null;
                                }
                                if (fieldMeta.type === 'Int') {
                                    cleanValue = parseInt(cleanValue, 10);
                                    if (isNaN(cleanValue)) cleanValue = null;
                                }
                                if (fieldMeta.type === 'Boolean') {
                                    cleanValue = (cleanValue === true || cleanValue === 'true' || cleanValue === 'SI' || cleanValue === 'Sí');
                                }
                                if (fieldMeta.type === 'DateTime') {
                                    const d = new Date(cleanValue);
                                    if (!isNaN(d.getTime())) cleanValue = d.toISOString();
                                    else cleanValue = null;
                                }
                            }
                            result[trueProp] = cleanValue;
                        }
                    }
                    break;
                }
            }
        }
    }
    return { data: result, relations };
}

const dateFields = new Set(["fechaActivacionCnmc","fechaBajaCnmc","fechaActivacionIsm","fechaBajaIsm","createdAt","updatedAt","createdAt","updatedAt","createdAt","updatedAt","createdAt","updatedAt","createdAt","updatedAt","offerDate","sipsLastModDate","signatureDate","requestDate","activationDate","permanenceStartDate","expectedEndDate","terminationDate","svaStartDate","discountStartDate","discountEndDate","createdAt","updatedAt","fechaPrevista","inicioProceso","fechaProceso","fechaAceptacion","fechaPrevistaActivacion","fechaIncidencia","fechaFacturaPenalizacion","ultimoDiaFacturado","ultDiaAFacturar","inicioMes0","inicioMesMinus1","finMesMinus1","inicioMesMinus2","finMesMinus2","finMes0","ultDiaFact","fechaVencimientoCalculada","createdAt","updatedAt","issueDate","paymentDate","billingStart","billingEnd","communicatedAt","createdAt","inicioBolsilloSolar","fechaFacturaRectificadaRef","createdAt","updatedAt","createdAt","updatedAt","createdAt","updatedAt","signatureDate","activationDate","createdAt","updatedAt","lastActivityAt","createdAt","updatedAt"]);
const floatFields = new Set(["penalizacion","estimatedMWh","customFee","customPExc","ipP1","ipP2","ipP3","ipP4","ipP5","ipP6","p1c","p2c","p3c","p4c","p5c","p6c","p1pDaily","p2pDaily","p3pDaily","p4pDaily","p5pDaily","p6pDaily","p1eActual","p2eActual","p3eActual","p4eActual","p5eActual","p6eActual","priceService","priceServiceActual","savings","annualConsumption","p1p","p2p","p3p","p4p","p5p","p6p","installedPowerGen","boePower","sipsP1c","sipsP2c","sipsP3c","sipsP4c","sipsP5c","sipsP6c","pcSum","sipsPcSum","varPc","demandaManualEne","demandaManualFeb","demandaManualMar","demandaManualAbr","demandaManualMay","demandaManualJun","demandaManualJul","demandaManualAgo","demandaManualSep","demandaManualOct","demandaManualNov","demandaManualDic","excedentesManualEne","excedentesManualFeb","excedentesManualMar","excedentesManualAbr","excedentesManualMay","excedentesManualJun","excedentesManualJul","excedentesManualAgo","excedentesManualSep","excedentesManualOct","excedentesManualNov","excedentesManualDic","fee","pexc","feeExcedentes","cgBolsilloSolar","deviationCost","p1e","p2e","p3e","p4e","p5e","p6e","price","commissionBase","commissionFinal","commissionVariable","penalization","svaPrice","customCGBolsilloSolar","customDeviationCost","customPlus","customP1E","customP2E","customP3E","customP4E","customP5E","customP6E","customP1P","customP2P","customP3P","customP4P","customP5P","customP6P","discountPrice","feeP","descuentoCie","decomision","decomision50","comision50","biPen","ivaPen","penalizacionEstimada","abonar","ajustePen","derechosExtension","ip","fc","porcComisionFijo","porcComisionVariable","ajusteConsumoComision","comisionAjustada","ajusteComisionDuracionPotencia","decomisionSobreAjuste","energiaPteMesMinus1","energiaPteMesMinus2","energiaPteMes0HastaHoy","energiaPteMes0HastaFinMes","pen20TdResid","penNoResid","pen20TdResidHoy","horasUsoDiarios","subtotal1","taxPercentage","taxAmount","totalAmount","totalMWh","margin","p1PotenciaContratada","p2PotenciaContratada","p3PotenciaContratada","p4PotenciaContratada","p5PotenciaContratada","p6PotenciaContratada","p1PotenciaMaxDemanda","p2PotenciaMaxDemanda","p3PotenciaMaxDemanda","p4PotenciaMaxDemanda","p5PotenciaMaxDemanda","p6PotenciaMaxDemanda","p1EnergiaActivaConsumida","p2EnergiaActivaConsumida","p3EnergiaActivaConsumida","p4EnergiaActivaConsumida","p5EnergiaActivaConsumida","p6EnergiaActivaConsumida","energiaReactivaTotalConsumida","p1EnergiaReactivaConsumida","p2EnergiaReactivaConsumida","p3EnergiaReactivaConsumida","p4EnergiaReactivaConsumida","p5EnergiaReactivaConsumida","p6EnergiaReactivaConsumida","p1PrecioEnergiaReactiva","p2PrecioEnergiaReactiva","p3PrecioEnergiaReactiva","p4PrecioEnergiaReactiva","p5PrecioEnergiaReactiva","p6PrecioEnergiaReactiva","penalizacionNoIcp","porcentajePerdidas","potenciaAFacturarP1","potenciaAFacturarP2","potenciaAFacturarP3","potenciaAFacturarP4","potenciaAFacturarP5","potenciaAFacturarP6","excedentesP1Autoconsumo","excedentesP2Autoconsumo","excedentesP3Autoconsumo","excedentesP4Autoconsumo","excedentesP5Autoconsumo","excedentesP6Autoconsumo","excedentesAutoconsumoAFacturar","importeAeP1","importeAeP2","importeAeP3","importeAeP4","importeAeP5","importeAeP6","importeTotalAeAtr","importePmP1","importePmP2","importePmP3","importePmP4","importePmP5","importePmP6","importeTotalPmAtr","importeExcesoPmP1","importeExcesoPmP2","importeExcesoPmP3","importeExcesoPmP4","importeExcesoPmP5","importeExcesoPmP6","importeTotalExcesosAtr","importeR1P1","importeR1P2","importeR1P3","importeR1P4","importeR1P5","importeR1P6","importeTotalRAtr","importeExcedentesAutoconsumo","suplementoTerritorial","subtotal2","conceptoRepercutible","subtotalOtrosConcepto","baseImponibleIva","iva","importeIva","total","disponibilidadLectura","precioDiaAlquiler1","precioDiaAlquiler2","precioDiaAlquiler3","precioDiaAlquiler4","importeIndemnizacion","alquilerEquipoDeMedida","ieOdoo","udsConceptoRepercutible1","precioConceptoRepercutible1","importeConceptoRepercutible1","udsConceptoRepercutible2","precioConceptoRepercutible2","importeConceptoRepercutible2","udsConceptoRepercutible3","precioConceptoRepercutible3","importeConceptoRepercutible3","costesDeGestion","importeCargoPotenciaTotal","importeCargoEnergiaTotal","totalImporteCargos","totalImportePeajes","baseImponibleF1","baseImponible0","baseImponible10","importeIva10","baseImponible21","importeIva21","importeTotalExcesosAtrF1","dsv","p1pm","p2pm","p3pm","p4pm","p5pm","p6pm","importePeajesAe","importePeajesPm","base560","importeBonoSocial","importePotenciaFactura","importePotenciaAtr","margenPotencia","margenExcesos","importeEnergiaFactura","importeEnergiaSinMargen","margenEnergia","margenFactura","comisionPotenciaCanal","comisionPrecioEnergia","comisionVolumenEnergia","importeAjusteGas","baseImponible5","importeIva5","importeEnergiaAtr","importeAplicableCompensacionExcedentes","importeExcedentesAutoconsumoAplicado","cargaBolsilloSolar","costesDeGestionBolsilloSolar","descuentoBolsilloSolar","importeAlmacenadoBolsilloSolar","comisionCostesDeGestion","comisionGapAutoconsumo","sistemaElectrico","propiedadExcedentes","comisionImporteExcedentario","importeFacturaRectificadaRef","precioUnitarioSva","totalSva","importeDevolucion","cg","p1em","p2em","p3em","p4em","p5em","p6em","importeAhorroCargos","porcentajeReduccionCargos","comisionSemiindexadoAnual","comisionPrecioFijoEnergia","recargoInfAnio","gapAutoconsumo","derechosGarantia","dsvm","feem","cgm","unidadesMix","precioMix","pExcedentes","importePenalizaciones","omiePromedioMah","baseImponibleAyuntamiento","tasaMunicipalForm","totalSinDescuento","importeTotalCoberturas","comisionTotal","baseImponibleTasaMunicipal","tasaMunicipal","totalCorr","totalSoftr","excTotal","baseImponibleIvaCorr","margenFtraRectificada","margenEstimado","importeImpuestoCorr","baseImponibleF1Corr","margenRelIngebau","margenFacturaDashboard","margenFacturaCorr","importeBonoSocialCorr","importeBonoSocialCORR","importeIVA","importeIVA10","importeIVA21","importeIVA5","importePotenciaATR","importeEnergiaATR","bISubtotal1CORR","importeAEP1","importeAEP2","importeExcesoPMP1","importeExcesoPMP2","importePMP1","importePMP2","importePonderadoATREnergiaP1","importePonderadoATREnergiaP2","importePonderadoATRPotenciaP1","importePonderadoATRPotenciaP2","importePonderadoCargosEnergiaP1","importePonderadoCargosEnergiaP2","importePonderadoCargosPotenciaP1","importePonderadoCargosPotenciaP2","importePonderadoPeajesEnergiaP1","importePonderadoPeajesEnergiaP2","importePonderadoPeajesPotenciaP1","importePonderadoPeajesPotenciaP2","precioPonderadoATREnergiaP1","precioPonderadoATREnergiaP2","precioPonderadoATRPotenciaP1","precioPonderadoATRPotenciaP2","precioPonderadoCargosEnergiaP1","precioPonderadoCargosEnergiaP2","precioPonderadoCargosPotenciaP1","precioPonderadoCargosPotenciaP2","precioPonderadoPeajesEnergiaP1","precioPonderadoPeajesEnergiaP2","precioPonderadoPeajesPotenciaP1","precioPonderadoPeajesPotenciaP2","reactivaTotalConsumida","baseImponibleF1CORR","totalCORR","p1C","p2C","p3C","p4C","p5C","p6C","cantidadEnergATotalConsumidaCORR","importeTotalExcesosATR","cuotaImporteImpuestoCORR","fEE","fEEM","importeAEP3","importeAEP4","importeAEP5","importeAEP6","importeDevoluciN","importeExcesoPMP3","importeExcesoPMP4","importeExcesoPMP5","importeExcesoPMP6","importeFacturaRectificada","importeImpuesto","importeImpuestoCORR","importeIndemnizaciN","importePeajesAE","importePeajesPM","importePMP3","importePMP4","importePMP5","importePMP6","importePonderadoATREnergiaP3","importePonderadoATREnergiaP4","importePonderadoATREnergiaP5","importePonderadoATREnergiaP6","importePonderadoATRPotenciaP3","importePonderadoATRPotenciaP4","importePonderadoATRPotenciaP5","importePonderadoATRPotenciaP6","importePonderadoCargosEnergia","importePonderadoCargosEnergiaP3","importePonderadoCargosEnergiaP4","importePonderadoCargosEnergiaP5","importePonderadoCargosEnergiaP6","importePonderadoCargosPotencia","importePonderadoCargosPotenciaP3","importePonderadoCargosPotenciaP4","importePonderadoCargosPotenciaP5","importePonderadoCargosPotenciaP6","importePonderadoPeajesEnergia","importePonderadoPeajesEnergiaP3","importePonderadoPeajesEnergiaP4","importePonderadoPeajesEnergiaP5","importePonderadoPeajesEnergiaP6","importePonderadoPeajesPotencia","importePonderadoPeajesPotenciaP3","importePonderadoPeajesPotenciaP4","importePonderadoPeajesPotenciaP5","importePonderadoPeajesPotenciaP6","importeTotalAEATR","importeTotalExcesosATRF1","importeTotalPMATR","importeTotalRATR","mARGENFACTURACORR","mARGENFACTURADASHBOARD","mARGENFTRARECTIFICADA","modoControlPotencia","pOTENCIABOE","pOTENCIASDISTRI","precioPonderadoATREnergiaP3","precioPonderadoATREnergiaP4","precioPonderadoATREnergiaP5","precioPonderadoATREnergiaP6","precioPonderadoATRPotenciaP3","precioPonderadoATRPotenciaP4","precioPonderadoATRPotenciaP5","precioPonderadoATRPotenciaP6","precioPonderadoCargosEnergiaP3","precioPonderadoCargosEnergiaP4","precioPonderadoCargosEnergiaP5","precioPonderadoCargosEnergiaP6","precioPonderadoCargosPotenciaP3","precioPonderadoCargosPotenciaP4","precioPonderadoCargosPotenciaP5","precioPonderadoCargosPotenciaP6","precioPonderadoPeajesEnergiaP3","precioPonderadoPeajesEnergiaP4","precioPonderadoPeajesEnergiaP5","precioPonderadoPeajesEnergiaP6","precioPonderadoPeajesPotenciaP3","precioPonderadoPeajesPotenciaP4","precioPonderadoPeajesPotenciaP5","precioPonderadoPeajesPotenciaP6","precioUnitarioSVA","totalSVA","uNPRECIO","peakPowerKwp","inverterPower","totalBudget","maintenanceCost","subsidy","annualSavings","monthlySavings","paybackYears","installmentAmount","fixedCommissionPct","variableCommissionPct","consumptionBasis","amount","relativeAmount"]);

const cache = {
    'CLIENTES': {}, 'INSTALACIONES': {}, 'LEADS': {}, 'PRODUCTOS': {}, 'FACTURAS': {}
};

async function syncRecord(table, recordId, prismaModelName, parentId = null, extraData = {}) {
    if (cache[table][recordId]) return cache[table][recordId];

    let record = null;
    if (!recordId.startsWith('mock_')) {
        record = await fetchAirtable(table, recordId);
    }
    
    if (!record) {
        record = { fields: {} };
    }

    const { data } = mapRecordToPrisma(table, record, prismaModelName);
    Object.assign(data, extraData); // Merge data extracted from parent CONTRATOS table!
    
    if (prismaModelName === 'client') {
        data.businessName = data.businessName || 'Client ' + recordId;
        data.vatNumber = data.vatNumber || 'VAT_' + recordId;
        data.brandId = (await getDefaultBrand()).id;
        
        let existing = await prisma.client.findUnique({ where: { vatNumber: data.vatNumber } });
        let created;
        if (existing) {
            created = await prisma.client.update({ where: { id: existing.id }, data });
        } else {
            created = await prisma.client.create({ data });
        }
        
        cache[table][recordId] = created.id;
        return created.id;
    }
    if (prismaModelName === 'supplyPoint') {
        if (!data.cups) data.cups = 'CUPS_' + recordId;
        // Assemble address
        const addrParts = [data.streetType, data.street, data.streetNumber, data.floor, data.door, data.addressAddition].filter(Boolean);
        data.address = addrParts.join(' ') || ('Address ' + recordId);
        data.city = data.city || 'City ' + recordId;
        data.postalCode = data.postalCode || '28001';
        data.province = data.province || 'Madrid';
        data.tariff = data.tariff || '2.0TD';
        if (parentId) data.clientId = parentId;
        
        let existing = await prisma.supplyPoint.findUnique({ where: { cups: data.cups } });
        let created;
        if (existing) {
            created = await prisma.supplyPoint.update({ where: { id: existing.id }, data });
        } else {
            created = await prisma.supplyPoint.create({ data });
        }
        
        cache[table][recordId] = created.id;
        return created.id;
    }
    if (prismaModelName === 'product') {
        data.name = data.name || 'Product ' + recordId;
        data.type = data.type || 'FIX';
        data.fee = data.fee || 0;
        data.brandId = (await getDefaultBrand()).id;

        // AED Energia Rule
        let commissionType = 'PORCENTAJE_MARGEN';
        if (data.tariff && data.tariff.includes('2.0TD')) {
            commissionType = 'TRAMOS_POTENCIA';
        } else if (record && record.fields && record.fields.Tarifa && record.fields.Tarifa.includes('2.0TD')) {
            commissionType = 'TRAMOS_POTENCIA';
        } else if (data.name && data.name.includes('2.0TD')) {
            commissionType = 'TRAMOS_POTENCIA';
        }
        data.commissionType = commissionType;

        const created = await prisma.product.create({ data });
        cache[table][recordId] = created.id;
        return created.id;
    }
    
    return null;
}

let defaultBrandId = null;
async function getDefaultBrand() {
    if (defaultBrandId) return { id: defaultBrandId };
    let brand = await prisma.brand.findFirst({ where: { name: 'AED' } });
    if (!brand) {
        let company = await prisma.company.findFirst({ where: { cif: 'AED_CIF' } });
        if (!company) company = await prisma.company.create({ data: { name: 'AED Energía', cif: 'AED_CIF', address: 'Madrid' } });
        brand = await prisma.brand.create({ data: { name: 'AED', codigoMarca: 'AED01', slug: 'aed', companyId: company.id } });
    }
    defaultBrandId = brand.id;
    return brand;
}

let defaultUserId = null;
async function getDefaultUser() {
    if (defaultUserId) return { id: defaultUserId };
    let user = await prisma.user.findFirst({ where: { email: 'admin@aed.com' } });
    if (!user) {
        user = await prisma.user.create({ data: { email: 'admin@aed.com', name: 'Admin AED', password: 'hash', brandId: (await getDefaultBrand()).id } });
    }
    defaultUserId = user.id;
    return user;
}

const userCache = {};
async function syncUser(airtableUserId) {
    if (userCache[airtableUserId]) return userCache[airtableUserId];
    const u = await fetchAirtable('USUARIOS', airtableUserId);
    if (!u || !u.fields) return (await getDefaultUser()).id;
    
    const email = u.fields['Email'] || `user_${airtableUserId}@aed.com`;
    let dbUser = await prisma.user.findFirst({ where: { email } });
    if (!dbUser) {
        dbUser = await prisma.user.create({
            data: {
                name: u.fields['Name'] || u.fields['Nombre'] || email.split('@')[0],
                email,
                password: 'hash',
                role: u.fields['Role'] === 'ADMIN' ? 'ADMIN' : 'CANAL',
                brandId: (await getDefaultBrand()).id
            }
        });
    }
    userCache[airtableUserId] = dbUser.id;
    return dbUser.id;
}

const channelCache = {};
async function syncChannel(airtableChannelId) {
    if (channelCache[airtableChannelId]) return channelCache[airtableChannelId];
    const c = await fetchAirtable('CANAL', airtableChannelId);
    if (!c || !c.fields) return null;
    
    const name = c.fields['Name'] || c.fields['Nombre'] || c.fields['Canal'] || `Channel ${airtableChannelId}`;
    let dbChannel = await prisma.channel.findFirst({ where: { name } });
    if (!dbChannel) {
        dbChannel = await prisma.channel.create({
            data: {
                name,
                brandId: (await getDefaultBrand()).id
            }
        });
    }
    channelCache[airtableChannelId] = dbChannel.id;
    return dbChannel.id;
}

async function main() {
    console.log('--- EMPEZANDO MIGRACIÓN MAESTRA DESDE AIRTABLE ---');
    console.log('Wipe previo garantizado por npx prisma db push --force-reset');
    
    const defaultUserId = (await getDefaultUser()).id;
    const brandId = (await getDefaultBrand()).id;

    console.log('1. Descargando 5 Contratos desde Airtable...');
    const contratosRes = await fetchAirtable('CONTRATOS', null, 'maxRecords=5');
    if (!contratosRes || !contratosRes.records) {
        throw new Error("No se pudieron obtener los contratos");
    }
    
    const contratos = contratosRes.records;
    console.log(`Obtenidos ${contratos.length} contratos.`);

    for (let i = 0; i < contratos.length; i++) {
        const c = contratos[i];
        console.log(`Procesando Contrato ${i + 1}/${contratos.length}: ${c.id}`);
        
        const { data: contractData, relations } = mapRecordToPrisma('CONTRATOS', c, 'contract');
        const { data: spDataFromContract } = mapRecordToPrisma('CONTRATOS', c, 'supplyPoint');
        const { data: clientDataFromContract } = mapRecordToPrisma('CONTRATOS', c, 'client');
        
        // Normalizar Estado del contrato para que coincida con UI/Prisma
        if (contractData.status) {
            let s = String(contractData.status).toUpperCase().trim();
            if (s.includes('ACTIV')) s = 'ACTIVO';
            else if (s.includes('BORRADOR')) s = 'BORRADOR';
            else if (s.includes('FINALIZADO')) s = 'FINALIZADO';
            else if (s.includes('RECHAZO DISTRIBUIDORA')) s = 'RECHAZO_DISTRIBUIDORA';
            else if (s.includes('RECHAZADO') || s.includes('RECHAZA')) s = 'RECHAZADO';
            else if (s.includes('TRAMITA')) s = 'TRAMITANDO';
            else if (s.includes('VERIFICANDO')) s = 'VERIFICANDO_FIRMA';
            else if (s.includes('BAJA')) s = 'BAJA';
            else if (s.includes('RENOVACI')) s = 'RENOVACION';
            else if (s.includes('ACEPTADO')) s = 'ACEPTADO';
            else s = 'TRAMITANDO'; // fallback for unknown states
            contractData.status = s;
        } else {
            contractData.status = 'TRAMITANDO';
        }

        // Normalización de campos redundantes
        if (!contractData.signatureDate) {
            contractData.signatureDate = contractData.fechafirma || contractData.fechafirmacontrato || null;
        }
        if (!contractData.svaConcept) {
            contractData.svaConcept = contractData.servicio || contractData.sERVICIORENOVACION || null;
        }
        if (!contractData.svaPrice) {
            contractData.svaPrice = contractData.preciofromSERVICIOS || null;
        }
        
        contractData.contractCode = contractData.contractCode || 'CONT_' + c.id;
        
        if (relations['Comercial'] && relations['Comercial'].length > 0) {
            contractData.userId = await syncUser(relations['Comercial'][0]);
        } else {
            contractData.userId = defaultUserId;
        }

        if (relations['CANAL'] && relations['CANAL'].length > 0) {
            const chanId = await syncChannel(relations['CANAL'][0]);
            if (chanId && contractData.userId !== defaultUserId) {
                 await prisma.user.update({
                     where: { id: contractData.userId },
                     data: { channelId: chanId }
                 });
            }
        }
        
        if (relations['CIF link'] && relations['CIF link'][0]) {
            contractData.clientId = await syncRecord('CLIENTES', relations['CIF link'][0], 'client', null, clientDataFromContract);
        } else {
            // Fallback
            contractData.clientId = await syncRecord('CLIENTES', 'mock_client_' + c.id, 'client', null, clientDataFromContract);
        }

        if (relations['INSTALACIONES_LINK'] && relations['INSTALACIONES_LINK'][0]) {
            contractData.supplyPointId = await syncRecord('INSTALACIONES', relations['INSTALACIONES_LINK'][0], 'supplyPoint', contractData.clientId, spDataFromContract);
        } else {
            contractData.supplyPointId = await syncRecord('INSTALACIONES', 'mock_sp_' + c.id, 'supplyPoint', contractData.clientId, spDataFromContract);
        }

        if (relations['ProductoLINK'] && relations['ProductoLINK'][0]) {
            contractData.productId = await syncRecord('PRODUCTOS', relations['ProductoLINK'][0], 'product');
        } else {
            contractData.productId = await syncRecord('PRODUCTOS', 'mock_prod_' + c.id, 'product');
        }

        try {
            let dbContract = await prisma.contract.findUnique({ where: { contractCode: contractData.contractCode } });
            if (dbContract) {
                dbContract = await prisma.contract.update({ where: { id: dbContract.id }, data: contractData });
            } else {
                dbContract = await prisma.contract.create({ data: contractData });
            }
            
            // Insert documents for contract
            for (const relKey in relations) {
                if (relKey.startsWith('_doc_')) {
                    const docType = relKey.replace('_doc_', '');
                    for (const fileObj of relations[relKey]) {
                        await prisma.document.create({
                            data: {
                                id: 'doc_' + fileObj.id + '_' + Math.random().toString(36).substr(2, 9),
                                name: fileObj.filename || docType,
                                type: 'OTHER',
                                url: fileObj.url,
                                contractId: dbContract.id,
                                clientId: dbContract.clientId,
                                updatedAt: new Date()
                            }
                        });
                    }
                }
            }
            
            if (relations['LEADS'] && relations['LEADS'].length > 0) {
                for (const leadId of relations['LEADS']) {
                    const leadRecord = await fetchAirtable('LEADS', leadId);
                    if (leadRecord) {
                        const { data: leadData } = mapRecordToPrisma('LEADS', leadRecord, 'lead');
                        leadData.contractId = dbContract.id;
                        leadData.userId = defaultUserId;
                        let dbLead = await prisma.lead.findUnique({ where: { contractId: dbContract.id } });
                    if (dbLead) {
                        await prisma.lead.update({ where: { id: dbLead.id }, data: leadData });
                    } else {
                        await prisma.lead.create({ data: leadData });
                    }
                    }
                }
            }
            
            if (relations['FACTURAS'] && relations['FACTURAS'].length > 0) {
                for (const facId of relations['FACTURAS']) {
                    const facRecord = await fetchAirtable('FACTURAS', facId);
                    if (facRecord) {
                        const { data: facData } = mapRecordToPrisma('FACTURAS', facRecord, 'invoice');
                        facData.contractId = dbContract.id;
                        facData.clientId = contractData.clientId;
                        facData.supplyPointId = contractData.supplyPointId;
                        facData.invoiceNumber = facData.invoiceNumber || 'FAC_' + facId;
                        
                        if (facData.issueDate) facData.issueDate = new Date(facData.issueDate);
                        else facData.issueDate = new Date();
                        if (facData.paymentDate) facData.paymentDate = new Date(facData.paymentDate);
                        if (facData.billingStart) facData.billingStart = new Date(facData.billingStart);
                        if (facData.billingEnd) facData.billingEnd = new Date(facData.billingEnd);
                        
                        facData.totalAmount = parseFloat(facData.totalAmount) || 0;
                        facData.totalMWh = parseFloat(facData.totalMWh) || 0;

                        for(const k in facData) {
                            if (facData[k] === "NaN" || Number.isNaN(facData[k])) facData[k] = null;
                        }

                        let dbInvoice = await prisma.invoice.findUnique({ where: { invoiceNumber: facData.invoiceNumber } });
                        if (dbInvoice) {
                            await prisma.invoice.update({ where: { id: dbInvoice.id }, data: facData });
                        } else {
                            await prisma.invoice.create({ data: facData });
                        }
                    }
                }
            }
            
        } catch (e) {
            console.error('Error insertando contrato ' + c.id, e.message);
        }
    }

    console.log('--- MIGRACIÓN 100% COMPLETADA ---');
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
