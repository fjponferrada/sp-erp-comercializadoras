import { loadEnvConfig } from '@next/env';
const projectDir = process.cwd();
loadEnvConfig(projectDir);
import { prisma } from './src/lib/prisma';

async function main() {
  console.log('Buscando empresa existente...');
  
  let company = await prisma.company.findFirst();
  
  const companyData = {
    name: 'AED Energia, SL',
    cif: 'B10915544',
    address: 'Avenida Gran Capitán, 23 - Oficina 5.3, 14008, Córdoba, España',
    email: 'fjponferrada@aed-energia.com',
    contactPerson: 'FRANCISCO JAVIER PONFERRADA RODRIGUEZ',
    phone: '900525826',
    codigoRee: '1713',
    codigoAcer: 'Código ACER',
    unidadOfertaOmie: 'AEDEC01',
    remit: 'AED',
    codigoSujetoMercado: '18X0000000000OIA',
    ordenCnmc: 'RS-950',
    fechaActivacionCnmc: new Date('2022-10-25T00:00:00Z'),
    fechaBajaCnmc: null,
    representadoPor: 'AED',
    fechaActivacionIsm: new Date('2022-11-01T00:00:00Z'),
    fechaBajaIsm: null,
    residenciaCanarias: false,
    exportableOdoo: false,
    empresaVisible: true,
    emisionFacturasCliente: true,
  };

  if (company) {
    company = await prisma.company.update({
      where: { id: company.id },
      data: companyData
    });
    console.log('Comercializadora actualizada:', company.name);
  } else {
    company = await prisma.company.create({
      data: companyData
    });
    console.log('Comercializadora creada:', company.name);
  }

  let brand = await prisma.brand.findFirst({
    where: { companyId: company.id }
  });

  const brandData = {
    name: 'AED Energia, SL',
    codigoMarca: 'AED',
    address: 'Calle del Brezo, 6, 14012 (Córdoba)',
    email: 'clientes@aed-energia.com',
    contactPerson: 'Fco Javier Ponferrada',
    phone: '900525826',
    clave: 'AED-MM-%05d',
    enviosPorHora: 130,
    facturaElectrica: 'AED ENERGIA ELECTRICA, S.L. C/Calle del Brezo, nº 6 14012 (Córdoba)',
    mensaje: 'Este mensaje se dirige exclusivamente a su destinatario y puede contener información privilegiada o confidencial...',
    textoPromocional: 'Gracias por confiar en AED Energía.',
    manual: 'https://aed-energia.com/',
    penalizacion: 0,
    marcaVisible: true,
    gestionTickets: true,
    envioPromocion: false,
    envioCliente: false,
    envioCorreo: false,
    companyId: company.id,
    slug: 'aed'
  };

  if (brand) {
    brand = await prisma.brand.update({
      where: { id: brand.id },
      data: brandData
    });
    console.log('Marca actualizada:', brand.name);
  } else {
    brand = await prisma.brand.create({
      data: brandData
    });
    console.log('Marca creada:', brand.name);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
