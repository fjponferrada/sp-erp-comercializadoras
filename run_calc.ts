import 'dotenv/config';
import { runCalculatePendingEnergy } from './src/scripts/calculate_pending_energy';

async function main() {
  await runCalculatePendingEnergy();
}
main();
