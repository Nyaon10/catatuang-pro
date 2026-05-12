// File: src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose'; // Kita gunakan 'jose' karena lebih ringan untuk middleware

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  const { pathname } = request.nextUrl;

  // 1. Biarkan orang mengakses halaman Login dan Register
  if (pathname === '/login' || pathname === '/register') {
    // Jika sudah punya token valid tapi malah buka login, lempar ke dashboard
    if (token) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  // 2. Jika TIDAK ada token, paksa ke halaman Login
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    // 3. Validasi token JWT
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || 'rahasia_catatuang_pro_super_aman_123'
    );
    
    await jwtVerify(token, secret);
    
    // Jika valid, silakan lanjut ke halaman yang dituju
    return NextResponse.next();
  } catch (error) {
    // Jika token palsu atau kedaluwarsa, hapus cookie dan paksa login ulang
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('token');
    return response;
  }
}

// Tentukan halaman mana saja yang dijaga oleh middleware ini
export const config = {
  matcher: [
    /*
     * Amankan semua halaman kecuali:
     * - api (api routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};