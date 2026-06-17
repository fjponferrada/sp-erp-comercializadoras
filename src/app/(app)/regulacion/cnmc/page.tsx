import { Metadata } from 'next';
import CnmcClient from './CnmcClient';

export const metadata: Metadata = {
  title: 'Reportes CNMC',
};

export default function CnmcPage() {
  return <CnmcClient />;
}
