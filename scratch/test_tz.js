const { TZDate } = require('@date-fns/tz');
const d = new TZDate(2026, 5, 4, 'Europe/Madrid'); // June 4th
console.log(d.toISOString());
