const fs = require('fs');

async function getIndicators() {
  const token = "521996e0d15e2db42c8261f9fba06bc9cf026ad9d75da2c1ea1a75f5120c09b4";
  const res = await fetch('https://api.esios.ree.es/indicators', {
    headers: { 'Authorization': `Token token="${token}"` }
  });
  const data = await res.json();
  fs.writeFileSync('indicators.json', JSON.stringify(data, null, 2));
}

getIndicators();
