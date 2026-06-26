const fs = require('fs');

async function check() {
  const token = "521996e0d15e2db42c8261f9fba06bc9cf026ad9d75da2c1ea1a75f5120c09b4";
  const start = "2026-03-01T00:00:00Z";
  const end = "2026-03-02T00:00:00Z";
  
  const indicators = [
    { id: 806, name: 'RT3' },
    { id: 807, name: 'RT6' },
    { id: 811, name: 'BS3' },
    { id: 813, name: 'EXD' },
    { id: 814, name: 'IN7' },
    { id: 1286, name: 'CFP' },
    { id: 1368, name: 'BALX' }
  ];

  for (const ind of indicators) {
    try {
      const url = `https://api.esios.ree.es/indicators/${ind.id}?start_date=${start}&end_date=${end}`;
      const res = await fetch(url, { headers: { 'Authorization': `Token token="${token}"` } });
      const data = await res.json();
      
      console.log(`\n--- ${ind.name} (ESIOS ID ${ind.id}) ---`);
      if (data.indicator && data.indicator.values) {
        data.indicator.values.forEach(v => {
          console.log(`${v.datetime}: ${v.value}`);
        });
      } else {
        console.log("No data found.");
      }
    } catch(e) {
      console.error(`Error fetching ${ind.name}:`, e.message);
    }
  }
}
check();
