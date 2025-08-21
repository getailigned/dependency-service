// Authentication Middleware for Dependency Service

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { LoggerService } from '../services/loggerService';
import { User } from '../types';

interface JwtPayload {
  sub: string;
  email: string;
  tenant_id: string;
  roles: string[];
  type: string;
  exp: number;
}

export class AuthMiddleware {
  private logger: LoggerService;
  private jwtSecret: string;

  constructor() {
    this.logger = new LoggerService();
    this.jwtSecret = process.env.JWT_SECRET || 'default-secret-change-in-production';
  }

  async authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Skip authentication for health checks
      if (req.path === '/health') {
        return next();
      }

      // Extract token from request
      const token = this.extractToken(req);
      
      if (!token) {
        res.status(401).json({
          success: false,
          error: 'NO_TOKEN',
          message: 'Authentication token is required',
          timestamp: new Date()
        });
        return;
      }

      // Verify and decode token
      const decoded = await this.verifyToken(token);
      
      if (!decoded) {
        res.status(401).json({
          success: false,
          error: 'INVALID_TOKEN',
          message: 'Authentication token is invalid or expired',
          timestamp: new Date()
        });
        return;
      }

      // Set user context in request
      const user: User = {
        id: decoded.sub,
        email: decoded.email,
        tenant_id: decoded.tenant_id,
        roles: decoded.roles
      };

      (req as any).user = user;

      this.logger.debug('User authenticated', {
        userId: user.id,
        email: user.email,
        tenantId: user.tenant_id,
        roles: user.roles
      });

      next();

    } catch (error) {
      this.logger.error('Authentication failed', { 
        error: error instanceof Error ? error.message : String(error),
        path: req.path,
        method: req.method
      });

      res.status(401).json({
        success: false,
        error: 'AUTHENTICATION_FAILED',
        message: 'Authentication failed',
        timestamp: new Date()
      });
    }
  }

  private extractToken(req: Request): string | null {
    // Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Check query parameter
    if (req.query.token) {
      return req.query.token as string;
    }

    return null;
  }

  private async verifyToken(token: string): Promise<JwtPayload | null> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as JwtPayload;
      
      // Check if token is expired
      if (decoded.exp && Date.now() >= decoded.exp * 1000) {
        this.logger.warn('Token expired', { userId: decoded.sub });
        return null;
      }

      // Check if token type is access token
      if (decoded.type !== 'access') {
        this.logger.warn('Invalid token type', { userId: decoded.sub, type: decoded.type });
        return null;
      }

      return decoded;

    } catch (error) {
      this.logger.warn('Token verification failed', { error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }
}

// Export middleware function
const authMiddleware = new AuthMiddleware().authenticate.bind(new AuthMiddleware());
export { authMiddleware };
