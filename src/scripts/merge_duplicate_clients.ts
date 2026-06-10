import { Client } from 'pg';
import { config } from 'dotenv';
config();

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  console.log("Iniciando fusión de clientes duplicados...");

  try {
    await client.query('BEGIN');

    const res = await client.query('SELECT id, "businessName", "vatNumber", "brandId" FROM "Client"');
    const allClients = res.rows;

    const byNameAndBrand: Record<string, typeof allClients> = {};
    for (const c of allClients) {
      const name = c.businessName ? c.businessName.trim().toUpperCase() : '';
      if (!name) continue;
      const key = `${name}_${c.brandId}`;
      if (!byNameAndBrand[key]) byNameAndBrand[key] = [];
      byNameAndBrand[key].push(c);
    }

    const groupsToProcess = [];

    for (const [key, clients] of Object.entries(byNameAndBrand)) {
      if (clients.length > 1) {
        const cifClients = clients.filter(c => c.vatNumber.match(/^[A-W]/i));
        const dniClients = clients.filter(c => c.vatNumber.match(/^[0-9XYZ]/i));
        
        if (cifClients.length > 0 && dniClients.length > 0) {
          // Tomar el primer CIF como el "bueno"
          const goodClient = cifClients[0];
          groupsToProcess.push({ goodClient, badClients: dniClients });
        }
      }
    }

    console.log(`Se procesarán ${groupsToProcess.length} grupos de clientes.`);
    let totalDeleted = 0;
    let totalContractsMoved = 0;
    let totalInvoicesMoved = 0;

    for (const group of groupsToProcess) {
      const goodId = group.goodClient.id;
      for (const bad of group.badClients) {
        const badId = bad.id;

        // Migrar relaciones
        const updateRelations = async (table: string, column: string = '"clientId"') => {
          const uRes = await client.query(`UPDATE "${table}" SET ${column} = $1 WHERE ${column} = $2`, [goodId, badId]);
          return uRes.rowCount;
        };

        totalContractsMoved += await updateRelations('Contract');
        await updateRelations('SupplyPoint');
        totalInvoicesMoved += await updateRelations('Invoice');
        await updateRelations('Document');
        await updateRelations('SolarQuote');
        await updateRelations('Ticket');

        // Borrar el cliente erróneo
        await client.query(`DELETE FROM "Client" WHERE id = $1`, [badId]);
        totalDeleted++;
      }
    }

    console.log(`Proceso finalizado con éxito.`);
    console.log(`Clientes con DNI eliminados: ${totalDeleted}`);
    console.log(`Contratos re-asignados: ${totalContractsMoved}`);
    console.log(`Facturas re-asignadas: ${totalInvoicesMoved}`);

    await client.query('COMMIT');
  } catch (error) {
    console.error("Error durante la fusión, haciendo rollback...", error);
    await client.query('ROLLBACK');
  } finally {
    await client.end();
  }
}

main().catch(console.error);
