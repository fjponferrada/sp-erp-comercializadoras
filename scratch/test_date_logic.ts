import { toZonedTime } from 'date-fns-tz';

function testUserLogic(dStr: string) {
  const parts = dStr.split('-');
  const dt = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]) + 1, 0, 0, 0);
  const result = new Date(dt.toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
  return result.toISOString();
}

function testBetterLogic(dStr: string) {
  // If we want 2023-01-31 to become 2023-02-01T00:00:00 in Madrid time
  const parts = dStr.split('-');
  
  // Construct UTC date as if it were midnight NEXT day in UTC
  const nextDay = new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]) + 1, 0, 0, 0));
  
  // Actually, we want the UTC time that corresponds to '00:00:00' in Europe/Madrid on `nextDay` date.
  // Using date-fns-tz it would be:
  // but date-fns-tz `tz` string parser is missing here. Let's just do it manually with Intl or just use the ISO string.
  return nextDay.toISOString(); // this is not quite Madrid time.
}

console.log("User logic (running on this machine):", testUserLogic("2023-01-31"));

// For Vercel simulation: Let's mock the local timezone as UTC.
process.env.TZ = 'UTC';
console.log("User logic (simulating Vercel UTC):", testUserLogic("2023-01-31"));
