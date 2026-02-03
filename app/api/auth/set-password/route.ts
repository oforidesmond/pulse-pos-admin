import { NextResponse } from 'next/server';
import { compare, hash } from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { username, currentPassword, newPassword } = await request.json();

    if (!username || !currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Username, current password and new password are required.' },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({ where: { username } });

    if (!user || !user.password) {
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    if (!user.needsPasswordChange) {
      return NextResponse.json({ error: 'Password reset is not required for this account.' }, { status: 400 });
    }

    const isValid = await compare(currentPassword, user.password);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid credentials.' }, { status: 401 });
    }

    const newHash = await hash(newPassword, 10);

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        password: newHash,
        needsPasswordChange: false,
      },
    });

    const { password: _pw, ...safeUser } = updated;
    return NextResponse.json({ user: safeUser });
  } catch (error) {
    console.error('Set password error', error);
    return NextResponse.json({ error: 'Unable to set password.' }, { status: 500 });
  }
}
