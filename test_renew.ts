import { renewContractAction } from './src/app/actions/renovacionesActions';

async function main() {
  const result = await renewContractAction('cmq6znj6w13qmic413rl4g8o9', 'recuMvmqYiDssk7XJ', false, undefined, [], 'TACITA');
  console.log(result);
}

main().catch(console.error);
