// File: src/app/api/auth/login/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ message: 'Email dan password wajib diisi' }, { status: 400 });
    }

    // 1. Cari user di database
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ message: 'Akun tidak ditemukan' }, { status: 404 });
    }

    // 2. Cocokkan password yang diketik dengan password yang di-hash
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return NextResponse.json({ message: 'Password salah' }, { status: 401 });
    }

    // 3. Buat Kunci JWT (Berlaku 10 Menit)
    const secretKey = process.env.JWT_SECRET || 'rahasia_default';
    const token = jwt.sign(
      { userId: user.id, email: user.email }, 
      secretKey, 
      { expiresIn: '10m' } // <--- Ini Timer 10 Menit Anda!
    );

    // 4. Masukkan Token ke dalam HTTP-Only Cookie (Sangat Aman)
    const response = NextResponse.json({ message: 'Login sukses!' }, { status: 200 });
    
    response.cookies.set('token', token, {
      httpOnly: true, // Tidak bisa dicuri oleh hacker via JavaScript
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60, // 10 menit (dalam detik)
      path: '/',
    });

    return response;

  } catch (error) {
    console.error('Login Error:', error);
    return NextResponse.json({ message: 'Terjadi kesalahan pada server' }, { status: 500 });
  }
}