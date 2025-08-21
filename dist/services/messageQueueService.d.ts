import { MessageQueueConnection } from '../types';
export declare class MessageQueueService implements MessageQueueConnection {
    private logger;
    private isConnected;
    constructor();
    connect(): Promise<void>;
    publish(exchange: string, routingKey: string, message: any): Promise<void>;
    subscribe(queue: string, callback: (message: any) => void): Promise<void>;
    publishDependencyEvent(event: any): Promise<void>;
    publishLineageEvent(event: any): Promise<void>;
    close(): Promise<void>;
}
//# sourceMappingURL=messageQueueService.d.ts.map