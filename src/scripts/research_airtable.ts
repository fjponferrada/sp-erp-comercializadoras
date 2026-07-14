import Airtable from 'airtable';

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID || 'appDimkTx3UGQ678C');

async function run() {
  try {
    const contracts = await base('CONTRATOS').select({ maxRecords: 1 }).firstPage();
    console.log("=== 1 CONTRATO ===");
    console.log(JSON.stringify(contracts[0]?.fields, null, 2));
  } catch (e) {
    console.error(e);
  }
}

run();
