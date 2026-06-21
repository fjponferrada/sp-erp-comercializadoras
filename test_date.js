const desde = '2026-06-12';
const d = new Date(desde + 'T00:00:00.000Z');
d.setHours(d.getHours() - 4);
console.log('d is:', d.toISOString());
const target = new Date('2026-06-11T22:00:00.000Z');
console.log('target is:', target.toISOString());
console.log('target >= d ?', target >= d);
