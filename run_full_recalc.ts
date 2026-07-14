import 'dotenv/config';
import { AggregationService } from './src/lib/services/AggregationService';
import { runCalculatePendingEnergy } from './src/scripts/calculate_pending_energy';

async function main() {
  console.log('Regenerating 150 days of aggregates...');
  await AggregationService.regenerateAggregates(150);
  console.log('Calculating pending energy...');
  await runCalculatePendingEnergy();
  console.log('Done!');
}
main().catch(console.error).finally(() => process.exit(0));
