const fs = require('fs');
async function searchEsios() {
  const token = "521996e0d15e2db42c8261f9fba06bc9cf026ad9d75da2c1ea1a75f5120c09b4";
  const res = await fetch('https://api.esios.ree.es/indicators', {
    headers: { 'Authorization': `Token token="${token}"` }
  });
  const data = await res.json();
  const indicators = data.indicators;
  
  const keywords = ['RT3','RT6','CT2','CT3','BS3','RAD3','RAD1','BALX','EXD','IN7','CFP','SECX', 'MI'];
  const mapping = {};
  
  keywords.forEach(kw => {
    const matches = indicators.filter(i => i.name.toUpperCase().includes(kw) || (i.short_name && i.short_name.toUpperCase().includes(kw)));
    mapping[kw] = matches.map(m => `${m.id}: ${m.name}`);
  });
  
  console.log(JSON.stringify(mapping, null, 2));
}
searchEsios();
