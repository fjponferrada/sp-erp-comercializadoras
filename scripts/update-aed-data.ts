import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();
const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function run() {
  console.log("Actualizando Comercializadora (Company)...");
  
  // Buscar la comercializadora AED (puede buscar por CIF B10915544 o un nombre similar)
  const company = await prisma.company.findFirst({
    where: {
      OR: [
        { cif: 'B10915544' },
        { name: { contains: 'AED', mode: 'insensitive' } }
      ]
    }
  });

  if (company) {
    const updatedCompany = await prisma.company.update({
      where: { id: company.id },
      data: {
        name: "AED Energía Eléctrica, S.L.",
        cif: "B10915544",
        address: "Avenida Gran Capitán, 23 - Oficina 5.3, 14008, Córdoba, España",
        email: "fjponferrada@aed-energia.com",
        contactPerson: "FRANCISCO JAVIER PONFERRADA RODRIGUEZ",
        phone: "900525826",
        codigoRee: "1713",
        codigoAcer: "", // Código ACER vacío
        unidadOfertaOmie: "AEDEC01",
        remit: "AED",
        codigoSujetoMercado: "18X000000000000A",
        ordenCnmc: "R2-950",
        fechaActivacionCnmc: new Date("2022-10-25T00:00:00.000Z"),
        representadoPor: "AED",
        fechaActivacionIsm: new Date("2022-11-01T00:00:00.000Z"),
        empresaVisible: true,
        emisionFacturasCliente: true,
      }
    });
    console.log("✅ Company actualizada:", updatedCompany.name);
  } else {
    console.log("❌ No se encontró la Company AED");
  }

  console.log("\nActualizando Marca (Brand)...");
  
  // Buscar la marca AED
  const brand = await prisma.brand.findFirst({
    where: {
      OR: [
        { codigoMarca: 'AED' },
        { name: { contains: 'AED', mode: 'insensitive' } },
        { slug: { contains: 'aed', mode: 'insensitive' } }
      ]
    }
  });

  if (brand) {
    const updatedBrand = await prisma.brand.update({
      where: { id: brand.id },
      data: {
        name: "AED Energía",
        codigoMarca: "AED",
        address: "Avenida Gran Capitán, 23 - Oficina 5.3, 14008, Córdoba, España",
        email: "clientes@aed-energia.com",
        contactPerson: "Fco Javier Ponferrada",
        phone: "900525826"
      }
    });
    console.log("✅ Brand actualizada:", updatedBrand.name);
  } else {
    console.log("❌ No se encontró la Brand AED");
  }
}

run()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
