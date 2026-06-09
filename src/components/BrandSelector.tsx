'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Building2, Check } from 'lucide-react';
import { setActiveBrandAction } from '@/app/actions/brandActions';

export default function BrandSelector() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [activeBrandId, setActiveBrandId] = useState<string>('');

  const user = session?.user as any;
  const allowedBrands = user?.allowedBrands || [];

  // Initialize active brand from cookies or fallback to primary brand
  useEffect(() => {
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift();
      return null;
    };
    
    const cookieBrandId = getCookie('active-brand');
    if (cookieBrandId && allowedBrands.some((b: any) => b.id === cookieBrandId)) {
      setActiveBrandId(cookieBrandId);
    } else if (user?.brandId) {
      setActiveBrandId(user.brandId);
    }
  }, [allowedBrands, user?.brandId]);

  if (!user || allowedBrands.length <= 1) return null;

  const activeBrand = allowedBrands.find((b: any) => b.id === activeBrandId) || allowedBrands[0];

  const handleSelect = async (brandId: string) => {
    setActiveBrandId(brandId);
    setIsOpen(false);
    await setActiveBrandAction(brandId);
    router.refresh();
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-700 transition-colors"
      >
        <Building2 size={14} className="text-lime-400" />
        <div className="flex flex-col items-start text-left">
          <span className="text-[0.65rem] text-slate-400 uppercase font-bold leading-tight">{activeBrand?.companyName || 'Empresa'}</span>
          <span className="text-[0.8rem] text-white font-medium leading-tight">{activeBrand?.name || 'Marca'}</span>
        </div>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-64 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-3 py-2 border-b border-slate-700 bg-slate-800/80">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Contexto de Trabajo</span>
            </div>
            <div className="max-h-60 overflow-y-auto p-1">
              {allowedBrands.map((brand: any) => (
                <button
                  key={brand.id}
                  onClick={() => handleSelect(brand.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between transition-colors ${activeBrandId === brand.id ? 'bg-lime-400/10 text-lime-400' : 'hover:bg-slate-700 text-slate-300'}`}
                >
                  <div className="flex flex-col">
                    <span className="text-[0.65rem] opacity-70 uppercase font-semibold">{brand.companyName}</span>
                    <span className="text-sm font-medium">{brand.name}</span>
                  </div>
                  {activeBrandId === brand.id && <Check size={14} />}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
