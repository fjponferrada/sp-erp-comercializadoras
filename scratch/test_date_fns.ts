import { fromZonedTime } from 'date-fns-tz';

// 2023-01-31 -> we want midnight of 2023-02-01 in Madrid.
// So local date/time string is "2023-02-01 00:00:00" in "Europe/Madrid".
const tz = 'Europe/Madrid';

try {
  const parts = "2023-01-31".split('-');
  const y = parseInt(parts[0]);
  const m = parseInt(parts[1]);
  const d = parseInt(parts[2]) + 1; // 32
  
  // Format as ISO-like string without Z: "2023-02-01T00:00:00"
  // Wait, Date constructor handles overflow:
  const overflowDate = new Date(Date.UTC(y, m - 1, d));
  const dateStr = overflowDate.toISOString().substring(0, 10) + 'T00:00:00';
  
  const utcDate = fromZonedTime(dateStr, tz);
  console.log("Resulting UTC date from date-fns-tz:", utcDate.toISOString());
} catch (e) {
  console.error(e);
}
