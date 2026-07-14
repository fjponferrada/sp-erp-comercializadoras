import fs from 'fs';

async function fetchINE() {
    const res = await fetch("https://raw.githubusercontent.com/codeforspain/ds-organizacion-administrativa/master/data/municipios.json");
    if (!res.ok) {
        console.error("Failed to fetch");
        return;
    }
    const data = await res.json();
    console.log(`Fetched ${data.length} populations`);
    fs.writeFileSync('./src/lib/municipios_ine.json', JSON.stringify(data, null, 2));
    
    // Check first 5 items to understand the schema
    console.log(data.slice(0, 5));
}
fetchINE();
