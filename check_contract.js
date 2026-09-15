const { Client } = require('pg');

async function main() {
    const client = new Client({
        connectionString: 'postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require&uselibpqcompat=true'
    });

    await client.connect();

    const res = await client.query(`
        SELECT c."id", c."terminationDate"
        FROM "Contract" c
        JOIN "SwitchingEvent" se ON se."contractId" = c."id"
        WHERE se."codigoSolicitud" = '202600000155' AND se."paso" = '06';
    `);

    console.log(res.rows);
    await client.end();
}

main().catch(console.error);