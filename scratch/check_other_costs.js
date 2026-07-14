const { Client } = require('pg');
const client = new Client({ connectionString: 'postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require&uselibpqcompat=true' });

async function main() {
    await client.connect();
    
    // Check Pagos Capacidad 3.0TD
    let res = await client.query("SELECT * FROM \"RegulatedCost\" WHERE concept='Pagos_Capacidad' AND tariff='3.0TD'");
    console.log("Pagos_Capacidad 3.0TD:", res.rows[0]);
    
    // Check FNEE
    res = await client.query("SELECT * FROM \"RegulatedCost\" WHERE concept='FNEE' AND tariff='3.0TD'");
    console.log("FNEE 3.0TD:", res.rows[0]);

    // Check Pago OM
    res = await client.query("SELECT * FROM \"RegulatedCost\" WHERE concept='Pago_OM' AND tariff='3.0TD'");
    console.log("Pago_OM 3.0TD:", res.rows[0]);

    // Check Pago OS
    res = await client.query("SELECT * FROM \"RegulatedCost\" WHERE concept='Pago_OS' AND tariff='3.0TD'");
    console.log("Pago_OS 3.0TD:", res.rows[0]);

    await client.end();
}

main().catch(console.error);
