const fetch = require('node-fetch');

async function search() {
  const res = await fetch('https://api.esios.ree.es/indicators', {
    headers: {
      'Accept': 'application/json; application/vnd.esios-api-v1+json',
      'Authorization': `Token token=${process.env.ESIOS_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });
  const data = await res.json();
  console.log(data);
}

search();
