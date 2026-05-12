// File: src/app/api/auth/logout/route.ts
import { NextResponse } from 'next/server';

export async function POST() {
  // Hapus cookie 'token' agar sesi berakhir
  const response = NextResponse.json({ message: 'Berhasil logout' }, { status: 200 });
  response.cookies.delete('token');
  return response;
}