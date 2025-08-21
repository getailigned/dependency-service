import { PoolClient } from 'pg';
import { DatabaseConnection } from '../types';
export declare class DatabaseService implements DatabaseConnection {
    private pool;
    private logger;
    constructor();
    query(text: string, params?: any[]): Promise<any>;
    transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T>;
    close(): Promise<void>;
}
//# sourceMappingURL=databaseService.d.ts.map