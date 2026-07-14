import 'dotenv/config';
import { AggregationService } from './src/lib/services/AggregationService';
import { runCalculatePendingEnergy } from './src/scripts/calculate_pending_energy';

async function main() {
  console.log('Forcing aggregation for 150 days to cover March 2026...');
  await AggregationService.regenerateAggregates(150);
  console.log('Recalculating pending energy...');
  await runCalculatePendingEnergy();
  console.log('Done!');
}
main().catch(console.error);
