import { Request, Response } from 'express';
import { DependencyService } from '../services/dependencyService';
export declare class DependencyController {
    private dependencyService;
    private logger;
    constructor(dependencyService: DependencyService);
    createDependency(req: Request, res: Response): Promise<void>;
    updateDependency(req: Request, res: Response): Promise<void>;
    deleteDependency(req: Request, res: Response): Promise<void>;
    getDependency(req: Request, res: Response): Promise<void>;
    getDependencyGraph(req: Request, res: Response): Promise<void>;
    getCriticalPath(req: Request, res: Response): Promise<void>;
    detectCycles(req: Request, res: Response): Promise<void>;
    private handleError;
}
//# sourceMappingURL=dependencyController.d.ts.map