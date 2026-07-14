import 'dotenv/config';
import { GET } from '../src/app/api/cron/train-forecast/route';

async function main() {
  console.log('Running initial background trainer script manually...');
  // Mock request object
  const req = new Request('http://localhost:3000/api/cron/train-forecast');
  const res = await GET(req);
  const data = await res.json();
  console.log('Result:', data);
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
