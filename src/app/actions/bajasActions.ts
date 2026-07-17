'use server';

import { prisma } from '@/lib/prisma';
import { getUserVisibilityFilter } from '@/lib/permissions';
import { auth } from '@/auth';

export async function getPaginatedBajasAction(
  page: number,
  itemsPerPage: number,
  search: string,
  motivoFilter: string,
  canalFilter: string = 'TODOS'
) {
  try {
    const visibilityFilter = await getUserVisibilityFilter();

    let whereClause: any = {
      ...visibilityFilter,
      status: { in: ['BAJA', 'FINALIZADO'] },
      supplyPoint: {
        contracts: {
          none: {
            status: { in: ['ACTIVO', 'TRAMITANDO', 'VERIFICANDO_FIRMA', 'ACEPTADO'] }
          }
        }
      }
    };

    if (search) {
      whereClause.OR = [
        { contractCode: { contains: search, mode: 'insensitive' } },
        { supplyPoint: { cups: { contains: search, mode: 'insensitive' } } },
        { client: { businessName: { contains: search, mode: 'insensitive' } } },
        { client: { firstName: { contains: search, mode: 'insensitive' } } },
        { client: { lastName: { contains: search, mode: 'insensitive' } } },
        { client: { vatNumber: { contains: search, mode: 'insensitive' } } }
      ];
    }

    if (canalFilter !== 'TODOS') {
      whereClause.user = { channelId: canalFilter };
    }

    // Puesto que motivoFilter actual está hardcodeado a "Fin de permanencia", simulamos:
    if (motivoFilter !== 'TODOS') {
      if (motivoFilter !== 'Fin de permanencia') {
        return { success: true, bajas: [], totalCount: 0 };
      }
    }

    const totalCount = await prisma.contract.count({ where: whereClause });

    const dbBajas = await prisma.contract.findMany({
      where: whereClause,
      include: {
        client: true,
        supplyPoint: true,
        product: true,
        user: { include: { channel: true } },
        Lead: true
      },
      orderBy: { terminationDate: 'desc' },
      skip: (page - 1) * itemsPerPage,
      take: itemsPerPage
    });

    const bajasData = dbBajas.map((b: any) => {
      const dAlta = b.activationDate ? new Date(b.activationDate) : new Date();
      const dBaja = b.terminationDate ? new Date(b.terminationDate) : new Date();
      const diffTime = Math.abs(dBaja.getTime() - dAlta.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return {
        id: b.id,
        cups: b.supplyPoint?.cups || 'Desconocido',
        cliente: b.client?.businessName || `${b.client?.firstName || ''} ${b.client?.lastName || ''}`.trim() || 'Desconocido',
        clientId: b.clientId,
        telefono: b.client?.contactPhone || null,
        email: b.client?.contactEmail || null,
        tarifa: b.supplyPoint?.tariff || '2.0TD',
        mwh: b.supplyPoint?.annualConsumption || 0,
        fechaAlta: b.activationDate?.toISOString().split('T')[0] || '-',
        fechaBaja: b.terminationDate?.toISOString().split('T')[0] || '-',
        motivo: 'Fin de permanencia', // Airtable no tiene este campo exacto
        canal: b.user?.channel?.name || b.Lead?.source || 'Directo',
        producto: b.product?.name || 'Desconocido',
        diasVida: diffDays,
        hasSelfConsumption: b.supplyPoint?.hasSelfConsumption || false
      };
    });

    return { success: true, bajas: bajasData, totalCount };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getBajasStatsAction() {
  try {
    const visibilityFilter = await getUserVisibilityFilter();

    const dbBajas = await prisma.contract.findMany({
      where: {
        ...visibilityFilter,
        status: { in: ['BAJA', 'FINALIZADO'] },
        supplyPoint: {
          contracts: {
            none: {
              status: { in: ['ACTIVO', 'TRAMITANDO', 'VERIFICANDO_FIRMA', 'ACEPTADO'] }
            }
          }
        }
      },
      select: {
        activationDate: true,
        terminationDate: true,
        supplyPointId: true,
        supplyPoint: { select: { annualConsumption: true } }
      }
    });

    const totalCount = dbBajas.length;
    let totalMwhPerdido = 0;
    let totalDiasVidaContrato = 0;
    let bajasEsteMes = 0;

    const now = new Date();
    
    // Agrupar por CUPS para calcular vida real del cliente
    const cupsLifespan: Record<string, { minAlta: Date, maxBaja: Date }> = {};

    for (const b of dbBajas) {
      totalMwhPerdido += b.supplyPoint?.annualConsumption || 0;
      
      const dAlta = b.activationDate ? new Date(b.activationDate) : new Date();
      const dBaja = b.terminationDate ? new Date(b.terminationDate) : new Date();
      const diffTime = Math.abs(dBaja.getTime() - dAlta.getTime());
      totalDiasVidaContrato += Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (b.supplyPointId) {
        if (!cupsLifespan[b.supplyPointId]) {
          cupsLifespan[b.supplyPointId] = { minAlta: dAlta, maxBaja: dBaja };
        } else {
          if (dAlta < cupsLifespan[b.supplyPointId].minAlta) {
            cupsLifespan[b.supplyPointId].minAlta = dAlta;
          }
          if (dBaja > cupsLifespan[b.supplyPointId].maxBaja) {
            cupsLifespan[b.supplyPointId].maxBaja = dBaja;
          }
        }
      }

      if (
        b.terminationDate &&
        b.terminationDate.getMonth() === now.getMonth() &&
        b.terminationDate.getFullYear() === now.getFullYear()
      ) {
        bajasEsteMes++;
      }
    }

    let totalClientDias = 0;
    let cupsCount = 0;
    for (const [, span] of Object.entries(cupsLifespan)) {
      const diffTime = Math.abs(span.maxBaja.getTime() - span.minAlta.getTime());
      totalClientDias += Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      cupsCount++;
    }

    const avgDiasContrato = totalCount > 0 ? Math.round(totalDiasVidaContrato / totalCount) : 0;
    const avgDiasCliente = cupsCount > 0 ? Math.round(totalClientDias / cupsCount) : 0;

    return {
      success: true,
      stats: {
        totalBajas: totalCount,
        bajasEsteMes,
        totalMwhPerdido,
        avgDias: avgDiasContrato,
        avgClientDias: avgDiasCliente
      }
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function fetchBajaContext(cups: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error('No estás autenticado.');
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { brand: { include: { company: true } } }
    });

    if (!user?.brand?.company) {
      throw new Error('El usuario no tiene una compañía asociada.');
    }
    const emisora = user.brand.company.codigoRee || '';

    let destino = '';
    if (cups && cups.length >= 6 && cups.startsWith('ES')) {
      const sp = await prisma.supplyPoint.findFirst({
        where: { cups: { startsWith: cups.substring(0, 20) } }
      });
      
      if (sp?.distributorReeCode) {
        destino = sp.distributorReeCode;
      } else {
        destino = cups.substring(2, 6);
      }
    }

    return { success: true, emisora, destino };
  } catch (error: any) {
    console.error('Error fetching context:', error);
    return { success: false, error: error.message };
  }
}

export async function generateBajaXml(data: {
  emisora: string;
  destino: string;
  codigoSolicitud: string;
  cups: string;
  motivo: string;
  fechaPrevista: string;
}) {
  try {
    const { emisora, destino, codigoSolicitud, cups, motivo, fechaPrevista } = data;

    const rootNode = 'MensajeBajaSuspension';
    const now = new Date();
    const formattedDate = now.toISOString().split('.')[0];
    
    // Fetch client to put data in XML
    const sp = await prisma.supplyPoint.findFirst({
      where: { cups: { startsWith: cups.substring(0, 20) } },
      include: {
        contracts: {
          where: { status: { in: ['ACTIVO', 'TRAMITANDO'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { client: true }
        }
      }
    });

    const client = sp?.contracts?.[0]?.client;
    if (!client) {
      throw new Error('No se ha encontrado un cliente activo para este CUPS. Imposible generar el nodo <Cliente>.');
    }

    // Determine type of doc
    let tipoIdentificador = 'NIF';
    const vat = client.vatNumber.trim().toUpperCase();
    if (vat.match(/^[XYZ]/)) tipoIdentificador = 'NIE';
    else if (vat.match(/^[ABCDEFGHJNPQRSUVW]/)) tipoIdentificador = 'CIF';
    else if (vat.length > 9) tipoIdentificador = 'Pasaporte';

    let tipoPersona = 'F';
    if (tipoIdentificador === 'CIF') tipoPersona = 'J';

    let xmlNombre = '';
    if (tipoPersona === 'F') {
      const lastName = client.lastName || '';
      xmlNombre = `<NombrePersona>${client.firstName || '-'}</NombrePersona>
<PrimerApellido>${lastName.split(' ')[0] || '-'}</PrimerApellido>`;
      const segApellido = lastName.split(' ').slice(1).join(' ');
      if (segApellido) {
        xmlNombre += `\n<SegundoApellido>${segApellido}</SegundoApellido>`;
      }
    } else {
      xmlNombre = `<RazonSocial>${client.businessName}</RazonSocial>`;
    }

    let telefonoXml = '';
    if (client.contactPhone) {
      const phone = client.contactPhone.replace(/\D/g, '').slice(-9);
      if (phone.length === 9) {
        telefonoXml = `
<Telefono>
  <PrefijoPais>34</PrefijoPais>
  <Numero>${phone}</Numero>
</Telefono>`;
      }
    }

    const xml = `<${rootNode} xmlns="http://localhost/elegibilidad">
<Cabecera>
  <CodigoREEEmpresaEmisora>${emisora}</CodigoREEEmpresaEmisora>
  <CodigoREEEmpresaDestino>${destino}</CodigoREEEmpresaDestino>
  <CodigoDelProceso>B1</CodigoDelProceso>
  <CodigoDePaso>01</CodigoDePaso>
  <CodigoDeSolicitud>${codigoSolicitud}</CodigoDeSolicitud>
  <SecuencialDeSolicitud>01</SecuencialDeSolicitud>
  <FechaSolicitud>${formattedDate}</FechaSolicitud>
  <CUPS>${cups}</CUPS>
</Cabecera>
<BajaSuspension>
  <DatosSolicitud>
    <IndActivacion>A</IndActivacion>${fechaPrevista ? `
    <FechaPrevistaAccion>${fechaPrevista}</FechaPrevistaAccion>` : ''}
    <Motivo>${motivo}</Motivo>
  </DatosSolicitud>
  <Cliente>
    <IdCliente>
      <TipoIdentificador>${tipoIdentificador}</TipoIdentificador>
      <Identificador>${vat}</Identificador>
      <TipoPersona>${tipoPersona}</TipoPersona>
    </IdCliente>
    <Nombre>
      ${xmlNombre}
    </Nombre>${telefonoXml}
  </Cliente>
</BajaSuspension>
</${rootNode}>`;

    return { success: true, xml };
  } catch (error: any) {
    console.error('Error generando XML de baja:', error);
    return { success: false, error: error.message };
  }
}
