"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = exports.AuthMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const loggerService_1 = require("../services/loggerService");
class AuthMiddleware {
    constructor() {
        this.logger = new loggerService_1.LoggerService();
        this.jwtSecret = process.env.JWT_SECRET || 'default-secret-change-in-production';
    }
    async authenticate(req, res, next) {
        try {
            if (req.path === '/health') {
                return next();
            }
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
            const user = {
                id: decoded.sub,
                email: decoded.email,
                tenant_id: decoded.tenant_id,
                roles: decoded.roles
            };
            req.user = user;
            this.logger.debug('User authenticated', {
                userId: user.id,
                email: user.email,
                tenantId: user.tenant_id,
                roles: user.roles
            });
            next();
        }
        catch (error) {
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
    extractToken(req) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            return authHeader.substring(7);
        }
        if (req.query.token) {
            return req.query.token;
        }
        return null;
    }
    async verifyToken(token) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, this.jwtSecret);
            if (decoded.exp && Date.now() >= decoded.exp * 1000) {
                this.logger.warn('Token expired', { userId: decoded.sub });
                return null;
            }
            if (decoded.type !== 'access') {
                this.logger.warn('Invalid token type', { userId: decoded.sub, type: decoded.type });
                return null;
            }
            return decoded;
        }
        catch (error) {
            this.logger.warn('Token verification failed', { error: error instanceof Error ? error.message : String(error) });
            return null;
        }
    }
}
exports.AuthMiddleware = AuthMiddleware;
const authMiddleware = new AuthMiddleware().authenticate.bind(new AuthMiddleware());
exports.authMiddleware = authMiddleware;
//# sourceMappingURL=authMiddleware.js.map