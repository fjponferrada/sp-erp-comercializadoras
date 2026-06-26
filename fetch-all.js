const fs = require('fs');
async function run() {
  const res = await fetch('https://api.esios.ree.es/indicators', {
    headers: { 'Authorization': 'Token token="521996e0d15e2db42c8261f9fba06bc9cf026ad9d75da2c1ea1a75f5120c09b4"' }
  });
  const json = await res.json();
  fs.writeFileSync('all_esios.json', JSON.stringify(json, null, 2));
  console.log('Downloaded', json.indicators.length, 'indicators.');
}
run();
