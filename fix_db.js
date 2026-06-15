const { Client } = require('pg');

const client = new Client({
  connectionString: "postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require"
});

async function main() {
  await client.connect();
  // Find supply point
  const spRes = await client.query("SELECT id FROM \"SupplyPoint\" WHERE cups = 'ES0031101654201001PA0F'");
  if (spRes.rows.length > 0) {
    const spId = spRes.rows[0].id;
    // Update event
    await client.query("UPDATE \"SwitchingEvent\" SET \"supplyPointId\" = $1, \"tipoError\" = 'CONTRATO_NO_ACTIVO', warning = 'El CUPS existe, pero no hay un contrato en estado ACTIVO o TRAMITANDO para asignarle fechas.', \"isResolved\" = false WHERE \"uniqueProcess\" LIKE '%ES0031101654201001PA0F%'", [spId]);
    console.log("Updated event for CUPS ES0031101654201001PA0F");
  } else {
    console.log("No supply point found");
  }
  await client.end();
}

main().catch(console.error);
