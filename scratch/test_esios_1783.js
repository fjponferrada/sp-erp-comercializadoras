const fetch = require('node-fetch');

async function testEsios() {
  const token = process.env.ESIOS_API_TOKEN;
  const url = 'https://api.esios.ree.es/indicators/1783?start_date=2026-06-01T00:00:00Z&end_date=2026-06-01T23:59:59Z';
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json; application/vnd.esios-api-v1+json',
      'Authorization': `Token token="${token}"`
    }
  });
  if (!res.ok) {
    console.log(`Error: ${res.status}`);
    return;
  }
  const data = await res.json();
  const values = data.indicator?.values || [];
  console.log(`Indicador: ${data.indicator?.name}`);
  console.log(`Total valores devueltos en 1 día: ${values.length}`);
  if (values.length > 0) {
    console.log(`Ejemplo Q1 00:00: ${values[0].value}`);
    console.log(`Ejemplo Q2 00:15: ${values[1].value}`);
  }
}

testEsios();
