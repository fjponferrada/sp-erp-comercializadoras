'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export async function fetchAnulacionContext(cups: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new Error('No estás autenticado.');
    }

    // 1. Get Emisora from the user's company (we assume session.user.companyId or brand's company)
    // Wait, the user is associated with a Brand, and Brand has a Company.
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { brand: { include: { company: true } } }
    });

    if (!user?.brand?.company) {
      throw new Error('El usuario no tiene una compañía asociada.');
    }
    const emisora = user.brand.company.codigoRee || '';

    // 2. Get Destino from the SupplyPoint or directly from the CUPS string
    let destino = '';
    if (cups && cups.length >= 6 && cups.startsWith('ES')) {
      const sp = await prisma.supplyPoint.findFirst({
        where: { cups: { startsWith: cups.substring(0, 20) } }
      });
      
      if (sp?.distributorReeCode) {
        destino = sp.distributorReeCode;
      } else {
        // Fallback: The REE code is always characters 3-6 of the CUPS in Spain
        destino = cups.substring(2, 6);
      }
    }

    return { success: true, emisora, destino };
  } catch (error: any) {
    console.error('Error fetching context:', error);
    return { success: false, error: error.message };
  }
}

export async function generateAnulacionXml(data: {
  emisora: string;
  destino: string;
  proceso: string;
  codigoSolicitud: string;
  cups: string;
}) {
  try {
    const { emisora, destino, proceso, codigoSolicitud, cups } = data;

    // Determinar el paso según el proceso
    let paso = '08';
    
    if (proceso === 'C1' || proceso === 'C2') {
      paso = '08';
    } else if (proceso === 'A3' || proceso === 'M1') {
      paso = '06';
    } else if (proceso === 'B1') {
      paso = '03';
    }

    // Todos los procesos de anulación usan el mismo root node definido en AnulacionSolicitud.xsd
    const rootNode = 'MensajeAnulacionSolicitud';

    const now = new Date();
    // Format YYYY-MM-DDThh:mm:ss
    const formattedDate = now.toISOString().split('.')[0];

    const xml = `<${rootNode} xmlns="http://localhost/elegibilidad">
<Cabecera>
<CodigoREEEmpresaEmisora>${emisora}</CodigoREEEmpresaEmisora>
<CodigoREEEmpresaDestino>${destino}</CodigoREEEmpresaDestino>
<CodigoDelProceso>${proceso}</CodigoDelProceso>
<CodigoDePaso>${paso}</CodigoDePaso>
<CodigoDeSolicitud>${codigoSolicitud}</CodigoDeSolicitud>
<SecuencialDeSolicitud>01</SecuencialDeSolicitud>
<FechaSolicitud>${formattedDate}</FechaSolicitud>
<CUPS>${cups}</CUPS>
</Cabecera>
</${rootNode}>`;

    return { success: true, xml };
  } catch (error: any) {
    console.error('Error generando XML de anulación:', error);
    return { success: false, error: error.message };
  }
}
