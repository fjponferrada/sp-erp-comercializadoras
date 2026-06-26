const fs = require('fs');

async function check() {
  const token = "521996e0d15e2db42c8261f9fba06bc9cf026ad9d75da2c1ea1a75f5120c09b4";
  const start = "2026-03-01T00:00:00Z";
  const end = "2026-03-02T00:00:00Z";
  
  try {
      const url = `https://api.esios.ree.es/indicators/806?start_date=${start}&end_date=${end}`;
      const res = await fetch(url, { 
          headers: { 
              'Authorization': `Token token="${token}"`,
              'Accept': 'application/json; application/vnd.esios-api-v1+json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
          } 
      });
      console.log('Status:', res.status);
      if (res.ok) {
          const data = await res.json();
          console.log(data.indicator.values.slice(0, 3));
      } else {
          console.log(await res.text());
      }
  } catch(e) {
      console.error(e);
  }
}
check();
