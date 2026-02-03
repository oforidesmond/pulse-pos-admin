import { compare } from 'bcryptjs';
import { prisma } from './prisma';

export type AuthenticatedUser = {
  id: string;
  username: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'ATTENDANT';
};

export function parseBasicAuthHeader(header: string | null): { username: string; password: string } | null {
  if (!header || !header.startsWith('Basic ')) {
    return null;
  }

  try {
    const decoded = Buffer.from(header.replace('Basic ', '').trim(), 'base64').toString('utf-8');
    const [username, password] = decoded.split(':');

    if (!username || !password) {
      return null;
    }

    return { username, password };
  } catch (error) {
    console.error('Failed to parse basic auth header', error);
    return null;
  }
}

export async function authenticateBasicRequest(request: Request): Promise<AuthenticatedUser | null> {
  const credentials = parseBasicAuthHeader(request.headers.get('authorization'));

  if (!credentials) {
    return null;
  }

  const user = await prisma.user.findUnique({ where: { username: credentials.username } });

  if (!user || !user.password) {
    return null;
  }

  const isValid = await compare(credentials.password, user.password);

  if (!isValid) {
    return null;
  }

  return {
    id: user.id,
    username: user.username ?? '',
    role: user.role,
  };
}
