declare class DependencyApp {
    private app;
    private logger;
    private db;
    private messageQueue;
    private dependencyService;
    private dependencyController;
    constructor();
    private initializeServices;
    private setupMiddleware;
    private setupRoutes;
    private setupErrorHandling;
    start(): Promise<void>;
    shutdown(): Promise<void>;
}
declare const app: DependencyApp;
export default app;
//# sourceMappingURL=index.d.ts.map