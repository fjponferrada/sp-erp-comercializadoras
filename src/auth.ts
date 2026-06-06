import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
    error:  '/login',
  },
  providers: [
    Credentials({
      name: 'Credenciales',
      credentials: {
        email:    { label: 'Email',      type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          include: { brand: { include: { company: true } } },
        });

        if (!user) return null;

        const passwordOk = await bcrypt.compare(
          credentials.password as string,
          user.password,
        );
        if (!passwordOk) return null;

        return {
          id:        user.id,
          email:     user.email,
          name:      user.name,
          role:      user.role,
          brandId:   user.brandId,
          brandName: user.brand.name,
          companyId: user.brand.companyId,
          // Colores de la marca para inyectar el tema
          accentColor:  user.brand.accentColor,
          bgColor:      user.brand.bgColor,
          surfaceColor: user.brand.surfaceColor,
          borderColor:  user.brand.borderColor,
          logoUrl:      user.brand.logoUrl,
        };
      },
    }),
  ],
  callbacks: {
    // Persiste datos extra en el JWT
    async jwt({ token, user }) {
      if (user) {
        token.role        = (user as any).role;
        token.brandId     = (user as any).brandId;
        token.brandName   = (user as any).brandName;
        token.companyId   = (user as any).companyId;
        token.accentColor = (user as any).accentColor;
        token.bgColor     = (user as any).bgColor;
        token.surfaceColor= (user as any).surfaceColor;
        token.borderColor = (user as any).borderColor;
        token.logoUrl     = (user as any).logoUrl;
      }
      return token;
    },
    // Expone los datos del JWT en la sesión del cliente
    async session({ session, token }) {
      if (token) {
        session.user.role        = token.role        as string;
        session.user.brandId     = token.brandId     as string;
        session.user.brandName   = token.brandName   as string;
        session.user.companyId   = token.companyId   as string;
        session.user.accentColor = token.accentColor as string;
        session.user.bgColor     = token.bgColor     as string;
        session.user.surfaceColor= token.surfaceColor as string;
        session.user.borderColor = token.borderColor as string;
        session.user.logoUrl     = token.logoUrl     as string | null;
      }
      return session;
    },
  },
});
