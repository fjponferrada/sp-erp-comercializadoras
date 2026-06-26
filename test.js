const fs = require('fs');

async function check() {
  const token = "521996e0d15e2db42c8261f9fba06bc9cf026ad9d75da2c1ea1a75f5120c09b4";
  const start = "2026-03-01T00:00:00Z";
  const end = "2026-03-02T00:00:00Z";
  // Maybe time_trunc=hour or we need to pass a specific time trunc
  
  try {
      const url = `https://api.esios.ree.es/indicators/806?start_date=${start}&end_date=${end}&time_trunc=hour`;
      const res = await fetch(url, { headers: { 'Authorization': `Token token="${token}"` } });
      const data = await res.json();
      console.log(data);
  } catch(e) {
      console.error(e);
  }
}
check();
