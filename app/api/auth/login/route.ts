import { NextResponse } from 'next/server';
import { compare } from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required.' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { username } });

    if (!user || !user.password) {
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    // if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    //   return NextResponse.json({ error: 'Access denied. Insufficient privileges.' }, { status: 403 });
    // }

    const isValid = await compare(password, user.password);

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    if (user.needsPasswordChange) {
      const { password: _pw, ...safeUser } = user;
      return NextResponse.json({ user: safeUser, requiresPasswordChange: true });
    }

    const { password: _pw, ...safeUser } = user;
    const token = Buffer.from(`${username}:${password}`).toString('base64');

    return NextResponse.json({ user: safeUser, token });
  } catch (error) {
    console.error('Login error', error);
    return NextResponse.json({ error: 'Unable to process login.' }, { status: 500 });
  }
}
