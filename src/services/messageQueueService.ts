// Message Queue Service for Event Publishing - Simplified

import { MessageQueueConnection } from '../types';
import { LoggerService } from './loggerService';

export class MessageQueueService implements MessageQueueConnection {
  private logger: LoggerService;
  private isConnected = false;

  constructor() {
    this.logger = new LoggerService();
  }

  async connect(): Promise<void> {
    try {
      // For testing, just simulate connection
      this.isConnected = true;
      this.logger.info('Message Queue Service connected (test mode)');
    } catch (error) {
      this.logger.error('Failed to connect to RabbitMQ', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  async publish(exchange: string, routingKey: string, message: any): Promise<void> {
    try {
      if (!this.isConnected) {
        this.logger.warn('Publishing while disconnected, trying to reconnect...');
        await this.connect();
      }

      // For testing, just log the message
      this.logger.debug('Message published (test mode)', {
        exchange,
        routingKey,
        messageId: message.id || `msg_${Date.now()}`
      });

    } catch (error) {
      this.logger.error('Failed to publish message', {
        exchange,
        routingKey,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async subscribe(queue: string, callback: (message: any) => void): Promise<void> {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      // For testing, just log subscription
      this.logger.info('Subscribed to queue (test mode)', { queue });

    } catch (error) {
      this.logger.error('Failed to subscribe to queue', {
        queue,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  async publishDependencyEvent(event: any): Promise<void> {
    const routingKey = `dependency.${event.type}`;
    await this.publish('dependencies', routingKey, event);
  }

  async publishLineageEvent(event: any): Promise<void> {
    const routingKey = `lineage.${event.type}`;
    await this.publish('lineage', routingKey, event);
  }

  async close(): Promise<void> {
    try {
      this.isConnected = false;
      this.logger.info('Message Queue Service connection closed');
    } catch (error) {
      this.logger.error('Error closing RabbitMQ connection', { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }
}