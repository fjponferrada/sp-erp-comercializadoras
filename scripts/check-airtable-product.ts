import 'dotenv/config';
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;

fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/PRODUCTOS?filterByFormula=SEARCH("AED 24h",{Nombre Producto})`, {
  headers: { Authorization: "Bearer " + AIRTABLE_API_KEY }
})
.then(r => r.json())
.then(data => {
  const records = data.records.filter((r: any) => r.fields['Nombre Producto'] === 'AED 24h' || r.fields['Nombre Producto'].trim() === 'AED 24h');
  console.log(`Found ${records.length} records matching "AED 24h" exactly`);
  records.forEach((r: any) => {
    console.log(`- ID: ${r.id} | Tarifa: ${r.fields['Tarifa']} | Tipo: ${r.fields['Tipo de producto']}`);
  });
});
