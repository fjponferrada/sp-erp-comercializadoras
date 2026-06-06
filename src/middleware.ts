import { auth } from '@/auth';
import { NextResponse } from 'next/server';

// Rutas públicas que no requieren autenticación
const PUBLIC_ROUTES = ['/login'];

export default auth((req) => {
  const { nextUrl, auth: session } = req;
  const isPublic = PUBLIC_ROUTES.some(r => nextUrl.pathname.startsWith(r));

  // Si no está autenticado y la ruta no es pública → redirigir a login
  if (!session && !isPublic) {
    return NextResponse.redirect(new URL('/login', nextUrl));
  }

  // Si ya está autenticado e intenta acceder al login → redirigir al dashboard
  if (session && nextUrl.pathname === '/login') {
    return NextResponse.redirect(new URL('/', nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  // Aplica el middleware a todas las rutas excepto _next, assets y favicon
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
};
