import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

export class HttpError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function normalizeError(error: unknown): { statusCode: number; message: string } {
  if (error instanceof HttpError) {
    return { statusCode: error.statusCode, message: error.message };
  }

  if (error instanceof ZodError) return { statusCode: 400, message: 'Invalid request data' };
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') return { statusCode: 409, message: 'Record already exists' };
    if (error.code === 'P2003') return { statusCode: 400, message: 'Invalid related record' };
    if (error.code === 'P2025') return { statusCode: 404, message: 'Record not found' };
  }

  return { statusCode: 500, message: 'Unexpected server error' };
}
