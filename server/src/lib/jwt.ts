import jwt, { type Secret, type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';

export type JwtPayload = {
  sub: string;
  companyId: string;
  email: string;
  role: string;
};

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.jwtSecret as Secret, {
    expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): JwtPayload {
  const payload = jwt.verify(token, env.jwtSecret as Secret, { algorithms: ['HS256'] });
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (typeof payload === 'string' || typeof payload.sub !== 'string' ||
      typeof payload.companyId !== 'string' || typeof payload.email !== 'string' ||
      !uuid.test(payload.sub) || !uuid.test(payload.companyId)) throw new Error('Invalid token claims');
  return payload as JwtPayload;
}
