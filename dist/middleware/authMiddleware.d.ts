import { Request, Response, NextFunction } from 'express';
export declare class AuthMiddleware {
    private logger;
    private jwtSecret;
    constructor();
    authenticate(req: Request, res: Response, next: NextFunction): Promise<void>;
    private extractToken;
    private verifyToken;
}
declare const authMiddleware: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export { authMiddleware };
//# sourceMappingURL=authMiddleware.d.ts.map