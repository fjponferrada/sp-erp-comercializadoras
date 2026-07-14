const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require&uselibpqcompat=true' });

client.connect().then(async () => {
    const res = await client.query('SELECT concept, p1, p2, p3, p4, p5, p6 FROM "RegulatedCost" WHERE tariff = \'3.0TD\' AND "validFrom" = \'2024-12-31\'');
    let peajesE = res.rows.find(r => r.concept === 'Peajes_Energia');
    let cargosE = res.rows.find(r => r.concept === 'Cargos_Energia');
    let peajesP = res.rows.find(r => r.concept === 'Peajes_Potencia' || r.concept === 'PEAJES_POTENCIA');
    let cargosP = res.rows.find(r => r.concept === 'Cargos_Potencia' || r.concept === 'CARGOS_POTENCIA');
    
    if (peajesE && cargosE) {
        console.log("ENERGIA 3.0TD (Suma de Peajes y Cargos):");
        console.log("P1:", (peajesE.p1 + cargosE.p1).toFixed(6));
        console.log("P2:", (peajesE.p2 + cargosE.p2).toFixed(6));
        console.log("P3:", (peajesE.p3 + cargosE.p3).toFixed(6));
        console.log("P4:", (peajesE.p4 + cargosE.p4).toFixed(6));
        console.log("P5:", (peajesE.p5 + cargosE.p5).toFixed(6));
        console.log("P6:", (peajesE.p6 + cargosE.p6).toFixed(6));
    } else {
        console.log("No se encontraron peajes o cargos de energia para 3.0TD");
    }

    if (peajesP && cargosP) {
        console.log("POTENCIA 3.0TD (Suma de Peajes y Cargos):");
        console.log("P1:", (peajesP.p1 + cargosP.p1).toFixed(6));
        console.log("P2:", (peajesP.p2 + cargosP.p2).toFixed(6));
        console.log("P3:", (peajesP.p3 + cargosP.p3).toFixed(6));
        console.log("P4:", (peajesP.p4 + cargosP.p4).toFixed(6));
        console.log("P5:", (peajesP.p5 + cargosP.p5).toFixed(6));
        console.log("P6:", (peajesP.p6 + cargosP.p6).toFixed(6));
    } else {
        console.log("No se encontraron peajes o cargos de potencia para 3.0TD");
    }
}).finally(() => client.end());
