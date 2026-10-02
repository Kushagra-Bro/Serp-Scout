import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';

const secret = new TextEncoder().encode(env.JWT_SECRET);

export interface TokenPayload {
  userId: string;
  email: string;
  name: string;
  workspaceId?: string | null;
}

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

export async function signUserToken(payload: TokenPayload): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret);
}

export async function verifyUserToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return {
      userId: payload.userId as string,
      email: payload.email as string,
      name: payload.name as string,
      workspaceId: payload.workspaceId as string | undefined,
    };
  } catch (err) {
    return null;
  }
}
