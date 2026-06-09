import React from 'react';
import { prisma } from '@/lib/prisma';
import { Users, UserPlus, Shield, Briefcase, Mail } from 'lucide-react';

export default async function UsuariosPage() {
  const users = await prisma.user.findMany({
    include: {
      channel: true
    },
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="text-indigo-500" />
            Red Comercial y Usuarios
          </h1>
          <p className="text-slate-400 mt-1">Gestiona los accesos, roles y asociaciones a canales de comisiones.</p>
        </div>
        <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-colors">
          <UserPlus size={18} />
          Invitar Usuario
        </button>
      </div>

      <div className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-900/50 text-slate-400 text-xs uppercase font-semibold">
            <tr>
              <th className="px-6 py-4">Usuario</th>
              <th className="px-6 py-4">Contacto</th>
              <th className="px-6 py-4">Rol en CRM</th>
              <th className="px-6 py-4">Canal Asignado</th>
              <th className="px-6 py-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-slate-700/30 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 font-bold">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-white">{user.name}</div>
                      <div className="text-xs text-slate-500">Añadido {new Date(user.createdAt).toLocaleDateString('es-ES')}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1">
                    <span className="flex items-center gap-1 text-slate-400"><Mail size={14} /> {user.email}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 w-max ${
                    user.role === 'SUPERADMIN' || user.role === 'COMPANYADMIN' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                    user.role === 'BACKOFFICE' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                    'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  }`}>
                    <Shield size={12} /> {user.role}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {user.channel ? (
                    <span className="flex items-center gap-1.5 text-indigo-300 bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20 w-max">
                      <Briefcase size={14} /> {user.channel.name}
                    </span>
                  ) : (
                    <span className="text-slate-500 text-xs italic">No asociado</span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="text-indigo-400 hover:text-indigo-300 font-medium text-sm transition-colors">
                    Editar
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">No hay usuarios registrados.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
