import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import municipiosJson from '../src/lib/municipios_ine.json';

const PROVINCES: Record<string, string> = {
    "01": "Álava", "02": "Albacete", "03": "Alicante", "04": "Almería", "05": "Ávila",
    "06": "Badajoz", "07": "Illes Balears", "08": "Barcelona", "09": "Burgos", "10": "Cáceres",
    "11": "Cádiz", "12": "Castellón", "13": "Ciudad Real", "14": "Córdoba", "15": "A Coruña",
    "16": "Cuenca", "17": "Girona", "18": "Granada", "19": "Guadalajara", "20": "Gipuzkoa",
    "21": "Huelva", "22": "Huesca", "23": "Jaén", "24": "León", "25": "Lleida",
    "26": "La Rioja", "27": "Lugo", "28": "Madrid", "29": "Málaga", "30": "Murcia",
    "31": "Navarra", "32": "Ourense", "33": "Asturias", "34": "Palencia", "35": "Las Palmas",
    "36": "Pontevedra", "37": "Salamanca", "38": "Santa Cruz de Tenerife", "39": "Cantabria", "40": "Segovia",
    "41": "Sevilla", "42": "Soria", "43": "Tarragona", "44": "Teruel", "45": "Toledo",
    "46": "Valencia", "47": "Valladolid", "48": "Bizkaia", "49": "Zamora", "50": "Zaragoza",
    "51": "Ceuta", "52": "Melilla"
};

const STREET_TYPES = [
    { code: "CL", name: "Calle" }, { code: "AV", name: "Avenida" }, { code: "PZ", name: "Plaza" },
    { code: "CR", name: "Carretera" }, { code: "PS", name: "Paseo" }, { code: "CM", name: "Camino" },
    { code: "RD", name: "Ronda" }, { code: "TR", name: "Travesía" }, { code: "PJ", name: "Pasaje" },
    { code: "PG", name: "Polígono" }, { code: "PQ", name: "Parque" }, { code: "BR", name: "Barrio" },
    { code: "SC", name: "Sector" }, { code: "UR", name: "Urbanización" }, { code: "GL", name: "Glorieta" },
    { code: "CU", name: "Cuesta" }, { code: "CJ", name: "Callejón" }, { code: "RM", name: "Rambla" },
    { code: "VI", name: "Vía" }
];

async function main() {
    console.log("Iniciando seed de direcciones...");

    // 1. Street Types
    console.log("Insertando Tipos de Vía...");
    for (const st of STREET_TYPES) {
        await prisma.streetType.upsert({
            where: { code: st.code },
            update: { name: st.name },
            create: { code: st.code, name: st.name }
        });
    }

    // 2. Provinces
    console.log("Insertando Provincias...");
    for (const [code, name] of Object.entries(PROVINCES)) {
        await prisma.province.upsert({
            where: { code },
            update: { name },
            create: { code, name }
        });
    }

    // 3. Municipalities
    console.log("Insertando Municipios...");
    const provinces = await prisma.province.findMany();
    const provMap = new Map(provinces.map(p => [p.code, p.id]));

    let muniCount = 0;
    // We will do bulk inserts for municipalities to save time, or upsert.
    // Since there are 8000+, let's try a transaction of createMany
    // But we need to handle duplicates safely if script is re-run
    const existingMunis = await prisma.municipality.findMany({ select: { code: true } });
    const existingSet = new Set(existingMunis.map(m => m.code));

    const newMunis = [];
    for (const m of (municipiosJson as any[])) {
        const fullCode = m.municipio_id;
        if (!existingSet.has(fullCode)) {
            const pId = provMap.get(m.provincia_id);
            if (pId) {
                newMunis.push({
                    code: fullCode,
                    name: m.nombre,
                    provinceId: pId
                });
                existingSet.add(fullCode);
            }
        }
    }

    if (newMunis.length > 0) {
        await prisma.municipality.createMany({
            data: newMunis
        });
        muniCount = newMunis.length;
    }

    console.log(`Seed finalizado. ${STREET_TYPES.length} vías, ${Object.keys(PROVINCES).length} provincias, ${muniCount} municipios nuevos.`);
}

main().finally(() => prisma.$disconnect());
