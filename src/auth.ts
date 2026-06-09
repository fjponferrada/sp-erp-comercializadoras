import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import { authConfig } from './auth.config';

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  providers: [
    Credentials({
      name: 'Credenciales',
      credentials: {
        email:    { label: 'Email',      type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        fs.appendFileSync('auth-debug.log', `[${new Date().toISOString()}] Login attempt for: ${credentials?.email}\n`);
        if (!credentials?.email || !credentials?.password) return null;
        
        const cleanEmail = (credentials.email as string).trim();
        const cleanPassword = (credentials.password as string).trim();

        const user = await prisma.user.findUnique({
          where: { email: cleanEmail },
          include: { 
            brand: { include: { company: true } },
            assignedBrands: { include: { company: true } },
            companies: true
          },
        }).catch(err => {
          fs.appendFileSync('auth-debug.log', `[${new Date().toISOString()}] Prisma error: ${err.message}\n`);
          throw err;
        });

        if (!user) {
          fs.appendFileSync('auth-debug.log', `[${new Date().toISOString()}] User not found: ${cleanEmail}\n`);
          return null;
        }

        const passwordOk = await bcrypt.compare(
          cleanPassword,
          user.password,
        );
        if (!passwordOk) {
          fs.appendFileSync('auth-debug.log', `[${new Date().toISOString()}] Password mismatch\n`);
          return null;
        }

        let allBrands = [];
        
        if (user.role === 'SUPERADMIN') {
          // El superadmin tiene acceso a todas las marcas del sistema
          allBrands = await prisma.brand.findMany({
            include: { company: true }
          });
        } else if (user.role === 'COMPANYADMIN') {
          // El administrador de empresa tiene acceso a todas las marcas de sus empresas asignadas
          const companyIds = user.companies?.map(c => c.id) || [];
          const companyBrands = await prisma.brand.findMany({
            where: { companyId: { in: companyIds } },
            include: { company: true }
          });
          allBrands = [...((user as any).assignedBrands || []), ...companyBrands];
        } else {
          // El resto de roles solo a sus marcas asignadas explícitamente
          allBrands = [...((user as any).assignedBrands || [])];
        }

        // Deduplicate
        const uniqueBrandsMap = new Map();
        allBrands.forEach(b => {
          uniqueBrandsMap.set(b.id, {
            id: b.id,
            name: b.name,
            companyName: b.company?.name || 'Empresa'
          });
        });
        const allowedBrands = Array.from(uniqueBrandsMap.values());

        if (allowedBrands.length === 0) {
          fs.appendFileSync('auth-debug.log', `[${new Date().toISOString()}] User has no allowed brands: ${cleanEmail}\n`);
          throw new Error("Acceso denegado: No tienes ninguna comercializadora asignada.");
        }

        fs.appendFileSync('auth-debug.log', `[${new Date().toISOString()}] Returning user object for: ${user.email} (Role: ${user.role}, Brands: ${allowedBrands.length})\n`);

        return {
          id:        user.id,
          email:     user.email,
          name:      user.name,
          role:      user.role,
          brandId:   user.brandId,
          channelId: user.channelId,
          allowedBrands: allowedBrands,
          brandName: user.brand.name,
          companyId: user.brand.companyId,
          accentColor:  user.brand.accentColor,
          bgColor:      user.brand.bgColor,
          surfaceColor: user.brand.surfaceColor,
          borderColor:  user.brand.borderColor,
          logoUrl:      user.brand.logoUrl,
        };
      },
    }),
  ],
});
