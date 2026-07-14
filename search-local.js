const fs = require('fs');
const data = JSON.parse(fs.readFileSync('all_esios.json'));
const inds = data.indicators;

function search(terms) {
  const tLower = terms.map(t => t.toLowerCase());
  return inds.filter(i => {
    const txt = (i.name + " " + (i.short_name||"") + " " + (i.description||"")).toLowerCase();
    return tLower.some(t => txt.includes(t));
  });
}

console.log("--- RT6 ---");
search(["RT6", "Restricciones en tiempo real", "restricciones técnicas aplicadas durante la operación en tiempo real"]).forEach(i => console.log(i.id, i.name));

console.log("\n--- EXD ---");
search(["EXD", "saldo de desvíos", "liquidación de los desvíos"]).forEach(i => console.log(i.id, i.name));

console.log("\n--- BALX ---");
search(["BALX", "Balance de Energía", "energía de balance"]).forEach(i => console.log(i.id, i.name));

console.log("\n--- CT2 / CT3 ---");
search(["CT2", "CT3"]).forEach(i => console.log(i.id, i.name));

console.log("\n--- IN7 ---");
search(["IN7", "pagos por capacidad", "saldos de desvío de sistemas específicos"]).forEach(i => console.log(i.id, i.name));

console.log("\n--- CFP ---");
search(["CFP", "factor de potencia", "Control Factor Potencia"]).forEach(i => console.log(i.id, i.name));

console.log("\n--- RAD1X ---");
search(["RAD1", "reserva adicional de potencia"]).forEach(i => console.log(i.id, i.name));

