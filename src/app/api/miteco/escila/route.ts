import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { format } from 'date-fns';

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session || !session.user || !session.user.brandId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const yearStr = searchParams.get('year');
    if (!yearStr) {
      return NextResponse.json({ error: 'Falta el parámetro year' }, { status: 400 });
    }
    const year = parseInt(yearStr, 10);

    const startDate = new Date(`${year}-01-01T00:00:00.000Z`);
    const endDate = new Date(`${year}-12-31T23:59:59.999Z`);

    const invoices = await prisma.invoice.findMany({
      where: {
        client: { brandId: session.user.brandId },
        billingEnd: { gte: startDate, lte: endDate }
      },
      include: {
        supplyPoint: true,
        client: true
      }
    });

    const company = await prisma.company.findFirst({
      where: { brands: { some: { id: session.user.brandId } } }
    });

    // Agrupar por Provincia (CP) y luego por CNAE
    type CnaeGroup = { idCnae: string; descCnae: string; numEmpresas: Set<string>; numCups: Set<string>; energia: number };
    type ProvGroup = { codigo: string; desc: string; cnaes: Record<string, CnaeGroup> };
    
    const provincesMap: Record<string, ProvGroup> = {};

    invoices.forEach(inv => {
      const sp = inv.supplyPoint;
      if (!sp) return;

      const pc = sp.postalCode || inv.client.billingPostalCode || '00000';
      const provCode = pc.substring(0, 2);
      const provName = sp.province ? sp.province.toUpperCase() : 'DESCONOCIDA';

      if (!provincesMap[provCode]) {
        provincesMap[provCode] = { codigo: provCode, desc: provName, cnaes: {} };
      }

      // Determine CNAE logic
      let cnaeCode = sp.cnae || inv.client.cnae || '00';
      let cnaeId = cnaeCode.substring(0, 2);
      let cnaeDesc = 'OTRAS ACTIVIDADES';

      // Simplificación de mapeo a los códigos de ESCILA (CNAE de 2 dígitos o Usos Domésticos)
      // Si la tarifa es 2.0TD y no es empresa, solemos asignarlo a Usos Domésticos
      const isDomestic = sp.tariff === '2.0TD' && (!inv.client.vatNumber || inv.client.vatNumber.length === 9 && /^[0-9]{8}[A-Z]$/i.test(inv.client.vatNumber));
      
      if (isDomestic) {
        cnaeId = '74';
        cnaeDesc = 'USOS DOMESTICOS';
      } else {
        // En un caso real, requeriríamos una tabla completa de mapeo de ESCILA. 
        // Aquí pasamos el CNAE de 2 dígitos que exista en BD, o 39 por defecto para elctricidad
        if (cnaeId === '35') {
          cnaeId = '39';
          cnaeDesc = 'PRODUCCIÓN, TRANSPORTE Y DISTRIBUCION DE ENERGIA ELECTRICA';
        } else {
          // Asumir que el ID es el CNAE a 2 digitos y poner descripcion generica si no lo sabemos
          cnaeDesc = `SECTOR CNAE ${cnaeId}`;
        }
      }

      if (!provincesMap[provCode].cnaes[cnaeId]) {
        provincesMap[provCode].cnaes[cnaeId] = {
          idCnae: cnaeId,
          descCnae: cnaeDesc,
          numEmpresas: new Set(),
          numCups: new Set(),
          energia: 0
        };
      }

      const cnaeGroup = provincesMap[provCode].cnaes[cnaeId];
      cnaeGroup.numEmpresas.add(inv.clientId);
      cnaeGroup.numCups.add(sp.cups);
      // MWh
      cnaeGroup.energia += (inv.totalMWh || 0);
    });

    let xml = `<?xml version='1.0' encoding='ISO-8859-1'?>\n`;
    xml += `<FORMULARIO><CABECERA><VERSION_XML>1.0.0</VERSION_XML><TIPOCUESTIONARIO>${company?.name || 'EMPRESA'}</TIPOCUESTIONARIO><TIPOCUESTIONARIOID>3</TIPOCUESTIONARIOID><ANIO>${year}</ANIO></CABECERA>`;
    xml += `<EMPRESA><CIF_VAT>${company?.cif || ''}</CIF_VAT><NOMBRE_CONTACTO>${company?.contactPerson || ''}</NOMBRE_CONTACTO><CARGO_EMPRESA>Administrador</CARGO_EMPRESA><TELEFONO_CONTACTO>${company?.phone || ''}</TELEFONO_CONTACTO><EMAIL_CONTACTO>${company?.email || ''}</EMAIL_CONTACTO></EMPRESA>`;
    xml += `<CUESTIONARIO><LISTA_PROVINCIAS>`;

    // Format energia as 8 chars left padded with 0, a comma, and 2 decimals
    const formatEnergia = (val: number) => {
      // Assuming ESCILA expects MWh or GWh? In the example, Usos Domésticos had 00000158,49 which is likely GWh or MWh. Let's output MWh for now as it's common unless DAFNE expects GWh. DAFNE asked for GWh in the text, so let's output GWh if needed. But totalMWh is in MWh, let's keep it in MWh for precision and match the 8 chars + 2 decimals.
      // Wait, 1 GWh = 1000 MWh. In the example, 54 USOS DOMESTICOS in Cordoba with 1071 CUPS consume "5209,43". A domestic user consumes ~3 MWh/year. 1071 * 3 = 3200 MWh. So the unit "5209,43" IS MWh!
      const totalStr = val.toFixed(2).replace('.', ',');
      const parts = totalStr.split(',');
      const integerPart = parts[0].padStart(8, '0');
      return `${integerPart},${parts[1]}`;
    };

    Object.values(provincesMap).forEach(prov => {
      xml += `<PROVINCIA><DESC_PROVINCIA CODIGO="${prov.codigo}">${prov.desc}</DESC_PROVINCIA><LISTA_CNAES>`;
      Object.values(prov.cnaes).forEach(cnae => {
        xml += `<CNAE><ID_CNAE CODIGO="${cnae.idCnae}">${cnae.descCnae}</ID_CNAE>`;
        if (cnae.idCnae !== '74') {
          xml += `<NUM_EMPRESAS>${cnae.numEmpresas.size}</NUM_EMPRESAS>`;
        } else {
          // Sometimes domestic has NUM_EMPRESAS, sometimes it doesn't.
          xml += `<NUM_EMPRESAS>${cnae.numEmpresas.size}</NUM_EMPRESAS>`;
        }
        xml += `<NUM_CUPS>${cnae.numCups.size}</NUM_CUPS>`;
        xml += `<ENERGIA_COMERCIALIZADA>${formatEnergia(cnae.energia)}</ENERGIA_COMERCIALIZADA></CNAE>`;
      });
      xml += `</LISTA_CNAES></PROVINCIA>`;
    });

    xml += `</LISTA_PROVINCIAS><OBSERVACIONES>Generado automaticamente</OBSERVACIONES></CUESTIONARIO></FORMULARIO>`;

    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=ISO-8859-1',
        'Content-Disposition': `attachment; filename="ESCILA_${year}.xml"`
      }
    });

  } catch (error: any) {
    console.error('ESCILA error:', error);
    return NextResponse.json({ error: error.message || 'Error interno' }, { status: 500 });
  }
}
