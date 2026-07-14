import FianzasClient from './FianzasClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Devolución de Fianzas | AED Energía',
  description: 'Listado de abonos y fianzas importados mediante ficheros F1',
};

export default function FianzasPage() {
  return <FianzasClient />;
}
