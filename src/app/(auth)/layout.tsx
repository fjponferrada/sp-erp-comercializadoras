import { PublicBrandProvider } from '@/components/PublicBrandProvider';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <PublicBrandProvider>
      {children}
    </PublicBrandProvider>
  );
}
