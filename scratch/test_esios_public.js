const fetch = require('node-fetch');

async function getIndicators() {
  const url = 'https://api.esios.ree.es/indicators';
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json; application/vnd.esios-api-v1+json',
      // No token
    }
  });
  if (!res.ok) {
    console.log(`Error: ${res.status}`);
    return;
  }
  const data = await res.json();
  const profiles = data.indicators?.filter(i => 
    i.name.toLowerCase().includes('perfil')
  );
  console.log(profiles?.map(i => `${i.id}: ${i.name}`).join('\n'));
}

getIndicators();
