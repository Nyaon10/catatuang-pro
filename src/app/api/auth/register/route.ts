// File: src/app/api/auth/register/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcrypt';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ message: 'Email dan password wajib diisi' }, { status: 400 });
    }

    // 1. Cek apakah email sudah terdaftar di Supabase
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json({ message: 'Email ini sudah terdaftar!' }, { status: 409 });
    }

    // 2. Cincang (Hash) password menggunakan Bcrypt (tingkat kerumitan 10)
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. Simpan data ke database Supabase
    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
      }
    });

    return NextResponse.json({ message: 'Registrasi sukses! Silakan login.' }, { status: 201 });

  } catch (error) {
    console.error('Registration Error:', error);
    return NextResponse.json({ message: 'Terjadi kesalahan pada server' }, { status: 500 });
  }
}