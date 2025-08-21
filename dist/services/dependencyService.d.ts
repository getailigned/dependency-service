import { DatabaseConnection, MessageQueueConnection } from '../types';
import { Dependency, CreateDependencyRequest, UpdateDependencyRequest, DependencyGraph, CriticalPathAnalysis, CycleDetectionResult, User } from '../types';
export declare class DependencyService {
    private db;
    private messageQueue;
    private logger;
    constructor(db: DatabaseConnection, messageQueue: MessageQueueConnection);
    createDependency(user: User, data: CreateDependencyRequest): Promise<Dependency>;
    updateDependency(user: User, dependencyId: string, data: UpdateDependencyRequest): Promise<Dependency>;
    deleteDependency(user: User, dependencyId: string): Promise<void>;
    getDependencyById(user: User, dependencyId: string): Promise<Dependency | null>;
    getDependencyGraph(user: User, workItemIds?: string[]): Promise<DependencyGraph>;
    getCriticalPathAnalysis(user: User): Promise<CriticalPathAnalysis>;
    detectCyclesInTenant(user: User): Promise<CycleDetectionResult>;
    private buildDependencyGraph;
    private calculateCriticalPath;
    private detectCycles;
    private identifyBottlenecks;
    private calculateRiskScore;
    private estimateCompletionProbability;
    private estimateDuration;
    private generateCycleResolutions;
    private generateMitigationSuggestions;
    private wouldCreateCycle;
    private validateWorkItemsExist;
    private schedulePathRecalculation;
}
//# sourceMappingURL=dependencyService.d.ts.map