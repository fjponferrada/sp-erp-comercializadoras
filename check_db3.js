const { Client } = require('pg');

const client = new Client({
  connectionString: "postgres://66eac579e1d9a1c746f57ec7d2e8f66365779625a1401b77a77fbe2ce06bcfaa:sk_AVG9axzbc7q1h8JePCkX1@db.prisma.io:5432/postgres?sslmode=require"
});

async function main() {
  await client.connect();
  
  const events = await client.query("SELECT id, \"uniqueProcess\", \"supplyPointId\", warning, \"isResolved\", \"procesoBase\", \"codigoSolicitud\" FROM \"SwitchingEvent\" WHERE \"supplyPointId\" = 'cmq6zw4oq19xfic41hq7t01yt'");
  console.log("EVENTS FOR CUPS:", events.rows);

  const allEvents = await client.query("SELECT id, \"uniqueProcess\", \"codigoSolicitud\" FROM \"SwitchingEvent\" ORDER BY \"createdAt\" DESC LIMIT 5");
  console.log("LAST 5 EVENTS:", allEvents.rows);

  await client.end();
}

main().catch(console.error);
