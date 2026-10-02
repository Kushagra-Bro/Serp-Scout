import { Request, Response, NextFunction } from 'express';
import { verifyUserToken } from '../lib/auth.js';

export interface AuthenticatedRequest extends Request {
  _parsedAuth?: {
    userId: string;
    email?: string;
    sessionId?: string;
  };
  auth?: any;
}

export async function requireAuthenticatedUser(req: Request, res: Response, next: NextFunction) {
  // Idempotency: if already authenticated by an earlier middleware run, skip
  const existingAuth = (req as AuthenticatedRequest)._parsedAuth;
  if (existingAuth?.userId) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required. Please provide a valid Bearer token.',
      },
    });
    return;
  }

  const token = authHeader.split(' ')[1];
  const payload = await verifyUserToken(token);

  if (!payload || !payload.userId) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired authentication token. Please sign in again.',
      },
    });
    return;
  }

  (req as AuthenticatedRequest)._parsedAuth = {
    userId: payload.userId,
    email: payload.email,
  };

  next();
}
