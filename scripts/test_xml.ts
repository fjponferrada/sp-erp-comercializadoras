import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { normalizeProvincia, normalizeMunicipio, normalizeTipoVia } from '../src/lib/normalizeAddress';

async function main() {
    const claimCups = 'ES0031101402139001ZV0F';
    const sp = await prisma.supplyPoint.findFirst({
        where: { cups: { equals: claimCups, mode: 'insensitive' } },
        include: { client: { include: { brand: { include: { company: true } } } } }
    });

    const names = (sp?.client?.firstName || sp?.client?.businessName || '').split(' ');
    const nombrePila = names[0] || 'DESCONOCIDO';
    const primerApellido = names[1] || sp?.client?.lastName?.split(' ')[0] || 'DESCONOCIDO';
    const segundoApellido = names[2] || sp?.client?.lastName?.split(' ')[1] || '';

    let province = sp?.client?.province;
    let city = sp?.client?.city;
    let zip = sp?.client?.postalCode;
    let streetType = 'CL';
    let street = sp?.client?.address;
    let number = '0';

    const cAirtable: any = sp?.client?.airtableData || {};
    
    if (!zip || zip === '00000') {
        zip = cAirtable['Código Postal Titular'] || cAirtable['Código Postal Instalación'] || sp?.postalCode || '00000';
    }
    if (!province || province === '00') {
        province = cAirtable['PROVINCIA SOC'] || sp?.province || '00';
    }
    if (!city || city === '000000') {
        city = cAirtable['POBLACION SOC'] || sp?.city || '000000';
    }
    if (!street || street === 'DESCONOCIDA') {
        street = cAirtable['Calle Titular'] || cAirtable['DOMICILIO SOC'] || sp?.street || sp?.address || 'DESCONOCIDA';
        streetType = cAirtable['Tipo de vía Titular'] || sp?.streetType || 'CL';
        number = cAirtable['Número Titular'] !== undefined ? String(cAirtable['Número Titular']) : (sp?.streetNumber || '0');
    }

    const normProvincia = normalizeProvincia(zip);
    const rawMuni = normalizeMunicipio(zip, city);
    const normMunicipio = rawMuni === '000' ? '00000' : `${normProvincia}${rawMuni}`;
    const normTipoVia = normalizeTipoVia(streetType);

    console.log(`
<Nombre>
<NombreDePila>${nombrePila}</NombreDePila>
<PrimerApellido>${primerApellido}</PrimerApellido>
<SegundoApellido>${segundoApellido}</SegundoApellido>
</Nombre>
<Direccion>
<Provincia>${normProvincia}</Provincia>
<Municipio>${normMunicipio}</Municipio>
<CodPostal>${zip}</CodPostal>
<Via>
<TipoVia>${normTipoVia}</TipoVia>
<Calle>${street}</Calle>
<NumeroFinca>${number}</NumeroFinca>
</Via>
</Direccion>`);
}

main().finally(() => prisma.$disconnect());
