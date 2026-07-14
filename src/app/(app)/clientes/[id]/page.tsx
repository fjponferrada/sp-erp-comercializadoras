import React from 'react';
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import { Building2, User, Mail, Phone, MapPin } from 'lucide-react';
import ClientTabs from '@/components/clientes/ClientTabs';
import ClientHeaderActions from '@/components/clientes/ClientHeaderActions';

import Topbar from '@/components/Topbar';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

import { auth } from '@/auth';

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  // Await params carefully because of Next.js versions
  const resolvedParams = await params;
  
  const session = await auth();
  const userRole = session?.user?.role || 'CANAL';

  const client = await prisma.client.findUnique({
    where: { id: resolvedParams.id },
    include: {
      supplyPoints: true,
      contracts: {
        orderBy: { createdAt: 'desc' },
        include: { supplyPoint: true }
      },
      invoices: {
        include: { supplyPoint: true },
        orderBy: { issueDate: 'desc' }
      }
    }
  });

  if (!client) {
    notFound();
  }

  const isCompany = client.clientType === 'Jurídica' || client.businessName.toLowerCase().includes('s.l') || client.businessName.toLowerCase().includes('s.a');

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', paddingBottom: '100px' }}>
      <Topbar
        title="Ficha de Cliente"
        subtitle={client.businessName || `${client.firstName} ${client.lastName}`}
        showSearch={false}
        customActions={
          <Link href="/clientes" className="btn-ghost flex items-center gap-2">
            <ChevronLeft size={16} /> Volver a Clientes
          </Link>
        }
      />
      <div className="max-w-7xl w-full min-w-0 mx-auto px-4 md:px-6 py-8 space-y-6">
      {/* HEADER CLIENTE */}
      <div className="bg-slate-800/30 border border-slate-700 p-6 md:p-8 rounded-3xl relative overflow-hidden min-w-0">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none hidden md:block">
          {isCompany ? <Building2 className="w-48 h-48" /> : <User className="w-48 h-48" />}
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 min-w-0">
          <div className="flex items-center gap-6 min-w-0 max-w-full">
            <div className="w-20 h-20 shrink-0 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
              {isCompany ? <Building2 className="w-10 h-10 text-indigo-400" /> : <User className="w-10 h-10 text-indigo-400" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-1 min-w-0">
                <h1 className="text-2xl md:text-3xl font-bold text-white truncate max-w-full" title={client.businessName || `${client.firstName} ${client.lastName}`}>{client.businessName || `${client.firstName} ${client.lastName}`}</h1>
                {client.isMultipoint && (
                  <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-semibold px-2 py-0.5 rounded-full">
                    MULTIPUNTO
                  </span>
                )}
              </div>
              <p className="text-slate-400 flex items-center gap-2">
                CIF: <span className="text-slate-200 font-mono">{client.vatNumber}</span>
              </p>
            </div>
          </div>
          
          <ClientHeaderActions client={client} userRole={userRole} />
        </div>

        {/* INFO RÁPIDA DE CONTACTO */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8 pt-6 border-t border-slate-700/50 relative z-10">
          <div className="flex items-center gap-3 text-slate-300 min-w-0">
            <Mail className="w-5 h-5 text-slate-500 shrink-0" />
            <span className="truncate">{client.contactEmail || 'Sin email'}</span>
          </div>
          <div className="flex items-center gap-3 text-slate-300 min-w-0">
            <Phone className="w-5 h-5 text-slate-500 shrink-0" />
            <span className="truncate">{client.contactPhone || 'Sin teléfono'}</span>
          </div>
          <div className="flex items-center gap-3 text-slate-300 min-w-0">
            <MapPin className="w-5 h-5 text-slate-500 shrink-0" />
            <span className="truncate" title={[client.billingAddress, client.billingPostalCode, client.billingCity, client.billingProvince].filter(Boolean).join(', ')}>
              {[client.billingAddress, client.billingPostalCode, client.billingCity, client.billingProvince].filter(Boolean).join(', ') || 'Dirección no especificada'}
            </span>
          </div>
        </div>
      </div>

      {/* PESTAÑAS Y CONTENIDO (Componente Cliente) */}
      <ClientTabs 
        client={client} 
        supplyPoints={Array.from(new Map([...client.supplyPoints, ...client.contracts.map(c => c.supplyPoint).filter(Boolean)].map(sp => [sp?.id, sp])).values()) as any} 
        contracts={client.contracts} 
        invoices={client.invoices} 
        userRole={userRole}
      />
      </div>
    </div>
  );
}
