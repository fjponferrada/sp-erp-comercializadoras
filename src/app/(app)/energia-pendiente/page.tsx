import { getPendingEnergyAction } from '@/app/actions/energiaPendienteActions';
import EnergiaPendienteClient from './EnergiaPendienteClient';

export default async function EnergiaPendientePage() {
  const result = await getPendingEnergyAction();

  if (!result.success) {
    return (
      <div className="p-8 text-center text-red-500">
        Error al cargar los datos: {result.error}
      </div>
    );
  }

  return <EnergiaPendienteClient data={result.data} />;
}
