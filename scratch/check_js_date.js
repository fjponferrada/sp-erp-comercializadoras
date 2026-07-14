const d = new Date('2026-06-01T00:00:00.000Z');
console.log('00:00 UTC -> Local:', d.toLocaleDateString('es-ES'), d.getHours());

const d2 = new Date('2026-05-31T22:00:00.000Z');
console.log('22:00 UTC -> Local:', d2.toLocaleDateString('es-ES'), d2.getHours());
