import type { NextFunction, Request, Response } from 'express';
import { HttpError, normalizeError } from '../lib/errors.js';

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  const { statusCode, message } = normalizeError(error);

  if (error instanceof HttpError) {
    res.status(statusCode).json({ error: message, details: error.details });
    return;
  }

  res.status(statusCode).json({ error: message });
}
