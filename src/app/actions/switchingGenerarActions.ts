'use server';

import { prisma } from '@/lib/prisma';
import PizZip from 'pizzip';
import { getTramitationCodes } from '@/lib/tramitationMapper';
import { normalizeProvincia, normalizeMunicipio, normalizeTipoVia } from '@/lib/normalizeAddress';

// Helpers para normalizar
const normalizeDate = (d: Date) => d.toISOString().split('.')[0]; // YYYY-MM-DDTHH:mm:ss

const getTarifaAtrCode = (tariffText: string) => {
  if (!tariffText) return '018'; // Fallback
  const t = tariffText.toUpperCase().replace(/\s/g, '');
  // If it's already a 3-digit code
  if (/^\d{3}$/.test(t)) return t;
  
  if (t === '2.0TD') return '018';
  if (t === '3.0TD') return '019';
  if (t === '6.1TD') return '024';
  if (t === '6.2TD') return '025';
  if (t === '6.3TD') return '026';
  if (t === '6.4TD') return '027';
  return '018'; // Fallback
};

function removeAccents(str: string) {
  if (!str) return str;
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const generateCodigoSolicitud = (cups: string, companyCode: string) => {
  const timestamp = new Date().getTime().toString().slice(-6);
  return `${companyCode}${timestamp}${cups.substring(2, 6)}`;
};

export async function fetchPendingSwitchingContracts() {
  try {
    const contracts = await prisma.contract.findMany({
      where: {
        status: { notIn: ['ACTIVO', 'FINALIZADO', 'BAJA', 'RECHAZADO'] },
        activationDate: null,
        tipo: { notIn: ['R', 'E1'] } // Ignorar Renovación y Desistimiento
      },
      include: {
        client: true,
        supplyPoint: true,
        brand: {
          include: { company: true }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Ordenar en JS a igualdad de createdAt para usar Fecha firma del JSON (de más reciente a más antiguo)
    contracts.sort((a, b) => {
      const timeDiff = b.createdAt.getTime() - a.createdAt.getTime();
      if (timeDiff !== 0) return timeDiff;

      const dateA = (a.airtableData as any)?.['Fecha firma'] ? new Date((a.airtableData as any)['Fecha firma']).getTime() : 0;
      const dateB = (b.airtableData as any)?.['Fecha firma'] ? new Date((b.airtableData as any)['Fecha firma']).getTime() : 0;
      
      return dateB - dateA;
    });

    return {
      success: true,
      data: contracts.map(c => {
        const airtableData = c.airtableData as any || {};
        const hasAnexoAirtable = airtableData['PDF Anexo firmado'] && Array.isArray(airtableData['PDF Anexo firmado']) && airtableData['PDF Anexo firmado'].length > 0;
        const hasAnexo = !!c.fileAnexoFirmado || hasAnexoAirtable;

        const computedAddress = [
          c.supplyPoint.streetType,
          c.supplyPoint.street,
          c.supplyPoint.streetNumber ? `NÚM ${c.supplyPoint.streetNumber}` : null,
          c.supplyPoint.floor ? `Piso ${c.supplyPoint.floor}` : null,
          c.supplyPoint.door ? `Puerta ${c.supplyPoint.door}` : null,
          c.supplyPoint.addressAddition
        ].filter(Boolean).join(' ') || c.supplyPoint.address || '';

        return {
          id: c.id,
          cups: c.supplyPoint.cups,
          direccion: `${computedAddress} ${c.supplyPoint.postalCode || ''} ${c.supplyPoint.city || ''}`.trim().replace(/\s+/g, ' '),
          nif: c.client.vatNumber,
          nombre: c.client.businessName || `${c.client.firstName || ''} ${c.client.lastName || ''}`.trim(),
          proceso: c.tipo || getTramitationCodes(c.tramitationType).tipo || 'C1',
          tipoC2: c.tipoC2 || getTramitationCodes(c.tramitationType).tipoC2,
          contrato: c.contractCode || c.id,
          codDistribuidora: c.supplyPoint.distributor || c.supplyPoint.cups?.substring(2, 6),
          codComercializadora: c.brand?.company?.codigoRee || '0000',
          tipoTramitacion: c.tramitationType,
          estado: c.status,
          hasAnexo
        };
      })
    };
  } catch (error: any) {
    console.error('Error fetching pending contracts:', error);
    return { success: false, error: error.message };
  }
}

export async function generateSwitchingXmls(contractIds: string[]) {
  try {
    const contracts = await prisma.contract.findMany({
      where: { id: { in: contractIds } },
      include: {
        client: true,
        supplyPoint: true,
        brand: {
          include: { company: true }
        }
      }
    });

    const zip = new PizZip();
    let count = 0;
    const errors: { contrato: string; motivo: string }[] = [];

    for (const c of contracts) {
      const proceso = c.tipo || getTramitationCodes(c.tramitationType).tipo || 'C1';
      
      const cAirtableFallback: any = c.airtableData || (c as any).client?.airtableData || {};
      const tipoC2 = c.tipoC2 || getTramitationCodes(c.tramitationType).tipoC2 || cAirtableFallback['Tipo_c2'] || 'C2_A';

      const codEmisora = c.brand?.company?.codigoRee || '1713';
      const codDestinoRaw = c.supplyPoint.distributorReeCode || c.supplyPoint.distributor || cAirtableFallback['CODIGO REE DISTRIBUIDORA'] || c.supplyPoint.cups?.substring(2, 6) || '0021';
      const codDestino = codDestinoRaw.match(/\d{4}/)?.[0] || '0021';
      
      let rawTariff = '';
      if (typeof cAirtableFallback['tarifa'] === 'string') {
        rawTariff = cAirtableFallback['tarifa'];
      } else {
        rawTariff = (cAirtableFallback['Código Tarifa'] && cAirtableFallback['Código Tarifa'][0]) || cAirtableFallback['Tarifa'] || c.supplyPoint.tariff || '';
      }
      if (Array.isArray(rawTariff)) rawTariff = rawTariff[0];
      const mappedTarifa = getTarifaAtrCode(rawTariff);
      
      let codSolicitud = c.nSolicitud;
      if (!codSolicitud) {
        codSolicitud = Math.floor(Math.random() * 1000000000000).toString().padStart(12, '0');
      } else if (codSolicitud.length > 12) {
        codSolicitud = codSolicitud.substring(0, 12);
      } else if (codSolicitud.length < 12) {
        codSolicitud = codSolicitud.padStart(12, '0');
      }
      
      const now = new Date();
      const localISO = (new Date(now.getTime() - now.getTimezoneOffset() * 60000)).toISOString().slice(0, -1);
      const fechaSol = localISO.split('.')[0]; // YYYY-MM-DDTHH:mm:ss
      const clientName = c.client.businessName || (`${c.client.firstName || ''} ${c.client.lastName || ''}`).trim() || cAirtableFallback['NOMBRE Y APELLIDOS'] || cAirtableFallback['Titular'] || '';
      
      if (!c.supplyPoint.cups || !c.client.vatNumber || !codDestino || !codEmisora) {
        errors.push({
          contrato: c.contractCode || c.id,
          motivo: 'Faltan datos obligatorios (CUPS, NIF, Cod. Distribuidora o Comercializadora)'
        });
        continue; // Skip this contract
      }

      let rootNode = '';
      let payloadNode = '';
      let payloadContent = '';

      // Básicos de cliente (común a todos)
      const isCompany = /^[ABCDEFGHJNPQRSUVW]/i.test(c.client.vatNumber);
      const companyName = c.client.businessName || cAirtableFallback['NOMBRERAZON SOCIAL'] || cAirtableFallback['Razn Social'] || clientName;
        
      let nombreDePila = c.client.firstName || cAirtableFallback['Nombre de pila'] || cAirtableFallback['NOMBRERAZON SOCIAL'] || '';
      let primerApellido = c.client.lastName || cAirtableFallback['Primer Apellido'] || '';
      let segundoApellido = c.client.lastName2 || cAirtableFallback['Segundo Apellido'] || '';

      const clienteXml = `
        <Cliente>
          <IdCliente>
            <TipoIdentificador>NI</TipoIdentificador>
            <Identificador>${c.client.vatNumber}</Identificador>
          </IdCliente>
          <Nombre>
            ${isCompany 
              ? `<RazonSocial>${removeAccents(companyName)}</RazonSocial>` 
              : `<NombreDePila>${removeAccents(nombreDePila)}</NombreDePila><PrimerApellido>${removeAccents(primerApellido)}</PrimerApellido>${segundoApellido ? `<SegundoApellido>${removeAccents(segundoApellido)}</SegundoApellido>` : ''}`}
          </Nombre>
          <Telefono>
            <PrefijoPais>0034</PrefijoPais>
            <Numero>${c.client.contactPhone || c.client.representativePhone || '600000000'}</Numero>
          </Telefono>
        </Cliente>
      `.trim();

      let potencias = '';
      const periods = [
        c.p1c ?? c.supplyPoint.p1c, 
        c.p2c ?? c.supplyPoint.p2c, 
        c.p3c ?? c.supplyPoint.p3c, 
        c.p4c ?? c.supplyPoint.p4c, 
        c.p5c ?? c.supplyPoint.p5c, 
        c.p6c ?? c.supplyPoint.p6c
      ];
      periods.forEach((p, index) => {
        if (p) {
          potencias += `<Potencia Periodo="${index + 1}">${Math.round(p * 1000)}</Potencia>\n`;
        }
      });

      const cAirtable: any = c.airtableData || c.client.airtableData || {};
      const provRaw = c.client.billingProvince || c.supplyPoint.province || cAirtable['PROVINCIA'] || cAirtable['Provincia'] || '';
      const cityRaw = c.client.billingCity || c.supplyPoint.city || cAirtable['POBLACIÓN'] || cAirtable['Población'] || '';
      const postalCodeRaw = c.client.billingPostalCode || c.supplyPoint.postalCode || cAirtable['CP'] || cAirtable['C.P.'] || cAirtable['C. P.'] || '';
      const postalCode = String(postalCodeRaw).trim();
      
      const normProvincia = normalizeProvincia(postalCode) || '28';
      const rawMuni = normalizeMunicipio(postalCode, cityRaw);
      const normMunicipio = rawMuni === '000' ? '00000' : `${normProvincia}${rawMuni}`;
      const normTipoVia = normalizeTipoVia(c.client.billingStreetType || c.supplyPoint.streetType || 'CL');
      
      const fullStreet = c.client.billingStreet || c.supplyPoint.street || c.supplyPoint.address || '';
      
      const isBillingNumberValid = c.client.billingNumber && c.client.billingNumber !== '00' && c.client.billingNumber !== '0';
      const numeroFincaFinal = isBillingNumberValid ? c.client.billingNumber : (c.supplyPoint.streetNumber ? c.supplyPoint.streetNumber : (cAirtable['Número Titular'] !== undefined ? String(cAirtable['Número Titular']) : '00'));
      
      let personaContactoXml = '';
      if (!isCompany) {
        const fullPhysicalName = `${nombreDePila} ${primerApellido} ${segundoApellido}`.trim().replace(/\s+/g, ' ');
        personaContactoXml = removeAccents(fullPhysicalName);
      } else {
        let repNameRaw = c.client.representativeName;
        if (!repNameRaw) {
          repNameRaw = cAirtable['Nombre Contacto'] 
            ? `${cAirtable['Nombre Contacto']} ${cAirtable['Apellidos Contacto'] || ''}`.trim()
            : (cAirtable['Apoderado / Rep. Legal'] || cAirtable['NOMBRE Y APELLIDOS'] || cAirtable['Nombre Representante'] || cAirtable['Apoderado'] || '');
        }
        const repName = typeof repNameRaw === 'string' ? repNameRaw.trim() : '';
        const contactName = c.client.contactName ? `${c.client.contactName} ${c.client.contactLastName || ''}`.trim() : '';
        const fallbackCompany = repName || contactName || 'Representante Legal';
        personaContactoXml = removeAccents(fallbackCompany);
      }

      const clienteConDireccionXml = `
        <Cliente>
          <IdCliente>
            <TipoIdentificador>NI</TipoIdentificador>
            <Identificador>${c.client.vatNumber}</Identificador>
          </IdCliente>
          <Nombre>
            ${isCompany 
              ? `<RazonSocial>${removeAccents(companyName)}</RazonSocial>` 
              : `<NombreDePila>${removeAccents(nombreDePila)}</NombreDePila><PrimerApellido>${removeAccents(primerApellido)}</PrimerApellido>${segundoApellido ? `<SegundoApellido>${removeAccents(segundoApellido)}</SegundoApellido>` : ''}`}
          </Nombre>
          <Telefono>
            <PrefijoPais>0034</PrefijoPais>
            <Numero>${c.client.contactPhone || c.client.representativePhone || '600000000'}</Numero>
          </Telefono>
          <IndicadorTipoDireccion>F</IndicadorTipoDireccion>
          <Direccion>
            <Pais>ESPAÑA</Pais>
            <Provincia>${normProvincia}</Provincia>
            <Municipio>${normMunicipio || '28079'}</Municipio>
            <CodPostal>${postalCode || '28000'}</CodPostal>
            <Via>
              <TipoVia>${normTipoVia}</TipoVia>
              <Calle>${removeAccents(fullStreet)}</Calle>
              <NumeroFinca>${numeroFincaFinal}</NumeroFinca>
            </Via>
          </Direccion>
        </Cliente>
      `.trim();

      let autoconsumoXml = '';
      const autoType = c.supplyPoint.selfConsumptionType || cAirtableFallback.selfConsumptionType;
      
      let sendAutoconsumo = false;
      if (autoType) {
        if (proceso === 'M1') {
          // En M1 sólo se envía si explícitamente se está modificando/activando el autoconsumo
          if (cAirtableFallback.isAutoconsumoModification) {
            sendAutoconsumo = true;
          }
        }
      }

      if (sendAutoconsumo) {
        const tCups = c.supplyPoint.tipoCups || cAirtableFallback.tipoCups || '01';
        const cau = c.supplyPoint.cau || cAirtableFallback.cau || '';
        const tSub = c.supplyPoint.cauSubtype || cAirtableFallback.cauSubtype || '21';
        const col = c.supplyPoint.cauCollective || cAirtableFallback.cauCollective || 'N';
        const pGen = c.supplyPoint.installedPowerGen || cAirtableFallback.installedPowerGen || 0;
        let tInst = c.supplyPoint.installationType || cAirtableFallback.installationType || '01';
        tInst = String(tInst).padStart(2, '0');
        const esq = c.supplyPoint.meteringScheme || cAirtableFallback.meteringScheme || 'A';
        const cil = c.supplyPoint.cil || cAirtableFallback.cil || '';

        autoconsumoXml = `
          <Autoconsumo>
            <DatosSuministro>
              <TipoCUPS>${tCups}</TipoCUPS>
            </DatosSuministro>
            <DatosCAU>
              <CAU>${cau}</CAU>
              <TipoAutoconsumo>${autoType}</TipoAutoconsumo>
              <TipoSubseccion>${tSub}</TipoSubseccion>
              <Colectivo>${col}</Colectivo>
              <DatosInstGen>
                <PotInstaladaGen>${Math.round(parseFloat(String(pGen)))}</PotInstaladaGen>
                <TipoInstalacion>${tInst}</TipoInstalacion>
                <EsquemaMedida>${esq}</EsquemaMedida>
                <SSAA>N</SSAA>
              </DatosInstGen>
            </DatosCAU>
          </Autoconsumo>
        `;
      }

      const contratoGenericoXml = `
        <Contrato>
          ${autoconsumoXml.trim()}
          <TipoContratoATR>01</TipoContratoATR>
          <CondicionesContractuales>
            <TarifaATR>${mappedTarifa}</TarifaATR>
            <PotenciasContratadas>
              ${potencias.trim()}
            </PotenciasContratadas>
          </CondicionesContractuales>
          <Contacto>
            <PersonaDeContacto>${personaContactoXml}</PersonaDeContacto>
            <Telefono>
              <PrefijoPais>0034</PrefijoPais>
              <Numero>${c.client.contactPhone || c.client.representativePhone || '600000000'}</Numero>
            </Telefono>
          </Contacto>
        </Contrato>
      `.trim();

      switch(proceso) {
        case 'C1':
          rootNode = 'MensajeCambiodeComercializadorSinCambios';
          payloadNode = 'CambiodeComercializadorSinCambios';
          payloadContent = `
            <DatosSolicitud>
              <IndActivacion>A</IndActivacion>
              <ContratacionIncondicionalPS>N</ContratacionIncondicionalPS>
              <ContratacionIncondicionalBS>N</ContratacionIncondicionalBS>
            </DatosSolicitud>
            ${clienteXml}
          `;
          break;
        case 'C2':
          rootNode = 'MensajeCambiodeComercializadorConCambios';
          payloadNode = 'CambiodeComercializadorConCambios';
          
          let tipoModificacion = 'A'; // Por defecto técnica y administrativa si no especifica
          if (tipoC2 === 'S' || tipoC2 === 'C2_S') tipoModificacion = 'S';
          if (tipoC2 === 'N' || tipoC2 === 'C2_N') tipoModificacion = 'N';

          payloadContent = `
            <DatosSolicitud>
              <TipoModificacion>${tipoModificacion}</TipoModificacion>
              ${tipoModificacion === 'S' || tipoModificacion === 'A' ? '<TipoSolicitudAdministrativa>T</TipoSolicitudAdministrativa>' : ''}
              <CNAE>${c.supplyPoint.cnae || c.client.cnae || '3514'}</CNAE>
              <IndActivacion>A</IndActivacion>
              <ContratacionIncondicionalPS>N</ContratacionIncondicionalPS>
              <ContratacionIncondicionalBS>N</ContratacionIncondicionalBS>
            </DatosSolicitud>
            ${contratoGenericoXml}
            ${clienteConDireccionXml}
          `;
          break;
        case 'A3':
          rootNode = 'MensajeAlta';
          payloadNode = 'Alta';
          payloadContent = `
            <DatosSolicitud>
              <CNAE>${c.supplyPoint.cnae || c.client.cnae || '3514'}</CNAE>
              <IndActivacion>A</IndActivacion>
            </DatosSolicitud>
            ${contratoGenericoXml}
            ${clienteConDireccionXml}
          `;
          break;
        case 'M1':
          rootNode = 'MensajeModificacionDeATR';
          payloadNode = 'ModificacionDeATR';
          
          let tipoModificacionM1 = 'A'; // Por defecto técnica y administrativa si no especifica
          if (tipoC2 === 'S' || tipoC2 === 'M1_S') tipoModificacionM1 = 'S';
          if (tipoC2 === 'N' || tipoC2 === 'M1_N') tipoModificacionM1 = 'N';

          let tipoSolicitudAdministrativa = '';
          if (tipoModificacionM1 === 'S' || tipoModificacionM1 === 'A') {
             tipoSolicitudAdministrativa = cAirtable.tipoSolicitudAdministrativa || 'T'; // T por defecto para seguridad (sin subrogación) si no está especificado
             tipoSolicitudAdministrativa = `<TipoSolicitudAdministrativa>${tipoSolicitudAdministrativa}</TipoSolicitudAdministrativa>`;
          }

          payloadContent = `
            <DatosSolicitud>
              <TipoModificacion>${tipoModificacionM1}</TipoModificacion>
              ${tipoSolicitudAdministrativa}
              <CNAE>${c.supplyPoint.cnae || c.client.cnae || '3514'}</CNAE>
              <IndActivacion>A</IndActivacion>
            </DatosSolicitud>
            ${contratoGenericoXml}
            ${clienteConDireccionXml}
          `;
          break;
        case 'B1':
          rootNode = 'MensajeBajaSuspension';
          payloadNode = 'BajaSuspension';
          payloadContent = `
            <DatosSolicitud>
              <IndActivacion>A</IndActivacion>
            </DatosSolicitud>
            ${clienteXml}
          `;
          break;
        default:
          rootNode = 'MensajeCambiodeComercializadorSinCambios';
          payloadNode = 'CambiodeComercializadorSinCambios';
          payloadContent = `
            <DatosSolicitud>
              <IndActivacion>A</IndActivacion>
              <ContratacionIncondicionalPS>N</ContratacionIncondicionalPS>
              <ContratacionIncondicionalBS>N</ContratacionIncondicionalBS>
            </DatosSolicitud>
            ${clienteXml}
          `;
      }

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<${rootNode} xmlns="http://localhost/elegibilidad">
  <Cabecera>
    <CodigoREEEmpresaEmisora>${codEmisora}</CodigoREEEmpresaEmisora>
    <CodigoREEEmpresaDestino>${codDestino}</CodigoREEEmpresaDestino>
    <CodigoDelProceso>${proceso}</CodigoDelProceso>
    <CodigoDePaso>01</CodigoDePaso>
    <CodigoDeSolicitud>${codSolicitud}</CodigoDeSolicitud>
    <SecuencialDeSolicitud>01</SecuencialDeSolicitud>
    <FechaSolicitud>${fechaSol}</FechaSolicitud>
    <CUPS>${c.supplyPoint.cups}</CUPS>
  </Cabecera>
  <${payloadNode}>
    ${payloadContent}
  </${payloadNode}>
</${rootNode}>`;

      zip.file(`${proceso}_01_${codSolicitud}_${c.supplyPoint.cups}.xml`, xml);
      count++;
      
      await prisma.contract.update({
        where: { id: c.id },
        data: { nSolicitud: codSolicitud }
      });
    }

    if (count === 0 && errors.length > 0) {
      return { success: false, error: 'Ningún XML generado. Errores de validación.', validationErrors: errors };
    }

    if (count === 0) {
      return { success: false, error: 'No se generó ningún XML.' };
    }

    const zipBase64 = zip.generate({ type: 'base64' });

    return {
      success: true,
      fileContent: zipBase64,
      fileName: `Switching_Generados_${new Date().getTime()}.zip`,
      count,
      validationErrors: errors
    };

  } catch (error: any) {
    console.error('Error generating XMLs:', error);
    return { success: false, error: error.message };
  }
}
