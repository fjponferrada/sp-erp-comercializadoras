const { Client } = require('pg');
async function main() {
    const client = new Client({
        connectionString: 'postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require&uselibpqcompat=true'
    });
    await client.connect();
    
    // Fix Version 0 of this specific contract
    await client.query(`
        UPDATE "Contract"
        SET "terminationDate" = '2026-07-28T00:00:00.000Z'
        WHERE "id" = 'cmq6zu1e918f9ic415acxw7hb';
    `);
    console.log('Fixed Version 0');
    await client.end();
}
main().catch(console.error);