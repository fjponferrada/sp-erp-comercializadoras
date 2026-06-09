const fs = require('fs');
require('dotenv').config();

async function run() {
  const allProductsUrl = "https://api.airtable.com/v0/" + process.env.AIRTABLE_BASE_ID + "/PRODUCTOS?maxRecords=100&filterByFormula=" + encodeURIComponent("FIND('ERANOVUM BOE Index', {Nombre Producto})");
  const res = await fetch(allProductsUrl, { headers: { Authorization: "Bearer " + process.env.AIRTABLE_API_KEY } });
  if (res.ok) {
    const data = await res.json();
    console.log("PRODUCTS FOUND:", data.records.map(r => ({
      name: r.fields['Nombre Producto'],
      tipo: r.fields['Tipo de producto']
    })));
  }
}
run();
