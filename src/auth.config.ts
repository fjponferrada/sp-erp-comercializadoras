import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [], // Los providers con Prisma se inyectan en auth.ts para evitar romper el Edge Runtime
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role        = (user as any).role;
        token.brandId     = (user as any).brandId;
        token.channelId   = (user as any).channelId;
        token.allowedBrands = (user as any).allowedBrands || [];
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
    async session({ session, token }) {
      if (token) {
        session.user.id          = (token.sub || token.id) as string;
        session.user.role        = token.role        as string;
        session.user.brandId     = token.brandId     as string;
        session.user.channelId   = token.channelId   as string | null;
        session.user.allowedBrands = (token.allowedBrands as any[]) || [];
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
} satisfies NextAuthConfig;
