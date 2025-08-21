"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageQueueService = void 0;
const loggerService_1 = require("./loggerService");
class MessageQueueService {
    constructor() {
        this.isConnected = false;
        this.logger = new loggerService_1.LoggerService();
    }
    async connect() {
        try {
            this.isConnected = true;
            this.logger.info('Message Queue Service connected (test mode)');
        }
        catch (error) {
            this.logger.error('Failed to connect to RabbitMQ', {
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }
    async publish(exchange, routingKey, message) {
        try {
            if (!this.isConnected) {
                this.logger.warn('Publishing while disconnected, trying to reconnect...');
                await this.connect();
            }
            this.logger.debug('Message published (test mode)', {
                exchange,
                routingKey,
                messageId: message.id || `msg_${Date.now()}`
            });
        }
        catch (error) {
            this.logger.error('Failed to publish message', {
                exchange,
                routingKey,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }
    async subscribe(queue, callback) {
        try {
            if (!this.isConnected) {
                await this.connect();
            }
            this.logger.info('Subscribed to queue (test mode)', { queue });
        }
        catch (error) {
            this.logger.error('Failed to subscribe to queue', {
                queue,
                error: error instanceof Error ? error.message : String(error)
            });
            throw error;
        }
    }
    async publishDependencyEvent(event) {
        const routingKey = `dependency.${event.type}`;
        await this.publish('dependencies', routingKey, event);
    }
    async publishLineageEvent(event) {
        const routingKey = `lineage.${event.type}`;
        await this.publish('lineage', routingKey, event);
    }
    async close() {
        try {
            this.isConnected = false;
            this.logger.info('Message Queue Service connection closed');
        }
        catch (error) {
            this.logger.error('Error closing RabbitMQ connection', {
                error: error instanceof Error ? error.message : String(error)
            });
        }
    }
}
exports.MessageQueueService = MessageQueueService;
//# sourceMappingURL=messageQueueService.js.map