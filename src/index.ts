// Dependency Service Main Application

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config } from 'dotenv';

import { DatabaseService } from './services/databaseService';
import { MessageQueueService } from './services/messageQueueService';
import { DependencyService } from './services/dependencyService';
import { DependencyController } from './controllers/dependencyController';
import { LoggerService } from './services/loggerService';
import { authMiddleware } from './middleware/authMiddleware';

// Load environment variables
config();

class DependencyApp {
  private app: express.Application;
  private logger: LoggerService;
  private db!: DatabaseService;
  private messageQueue!: MessageQueueService;
  private dependencyService!: DependencyService;
  private dependencyController!: DependencyController;

  constructor() {
    this.app = express();
    this.logger = new LoggerService();
    
    this.initializeServices();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private initializeServices(): void {
    this.db = new DatabaseService();
    this.messageQueue = new MessageQueueService();
    this.dependencyService = new DependencyService(this.db, this.messageQueue);
    this.dependencyController = new DependencyController(this.dependencyService);
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    }));

    // CORS configuration
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }));

    // Rate limiting
    this.app.use(rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // Limit each IP to 1000 requests per windowMs
      message: {
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests from this IP'
      }
    }));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Compression
    this.app.use(compression());

    // Request logging
    this.app.use((req, _res, next) => {
      this.logger.info('Request received', {
        method: req.method,
        url: req.url,
        userAgent: req.get('user-agent'),
        ip: req.ip
      });
      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (_req, res) => {
      res.json({
        service: 'dependency-service',
        status: 'healthy',
        timestamp: new Date(),
        version: process.env.npm_package_version || '1.0.0'
      });
    });

    // API routes with authentication
    const apiRouter = express.Router();
    apiRouter.use(authMiddleware);

    // Dependency routes
    apiRouter.post('/dependencies', this.dependencyController.createDependency.bind(this.dependencyController));
    apiRouter.get('/dependencies/:id', this.dependencyController.getDependency.bind(this.dependencyController));
    apiRouter.put('/dependencies/:id', this.dependencyController.updateDependency.bind(this.dependencyController));
    apiRouter.delete('/dependencies/:id', this.dependencyController.deleteDependency.bind(this.dependencyController));

    // Graph and analysis routes
    apiRouter.get('/graph', this.dependencyController.getDependencyGraph.bind(this.dependencyController));
    apiRouter.get('/critical-path', this.dependencyController.getCriticalPath.bind(this.dependencyController));
    apiRouter.get('/cycles', this.dependencyController.detectCycles.bind(this.dependencyController));

    this.app.use('/api', apiRouter);

    // 404 handler
    this.app.use('*', (_req, res) => {
      res.status(404).json({
        success: false,
        error: 'ENDPOINT_NOT_FOUND',
        message: 'The requested endpoint was not found'
      });
    });
  }

  private setupErrorHandling(): void {
    this.app.use((error: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
      this.logger.error('Unhandled error', {
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method
      });

      res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred'
      });
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled Promise Rejection', {
        reason: reason?.toString(),
        promise: promise.toString()
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught Exception', {
        error: error.message,
        stack: error.stack
      });
      process.exit(1);
    });
  }

  async start(): Promise<void> {
    try {
      // Connect to message queue
      await this.messageQueue.connect();
      this.logger.info('Message queue connected successfully');

      // Start server
      const port = process.env.PORT || 3005;
      this.app.listen(port, () => {
        this.logger.info(`Dependency Service started on port ${port}`);
      });

    } catch (error) {
      this.logger.error('Failed to start Dependency Service', { error: error instanceof Error ? error.message : String(error) });
      process.exit(1);
    }
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Dependency Service...');
    
    try {
      await this.db.close();
      await this.messageQueue.close();
      this.logger.info('Dependency Service shutdown complete');
    } catch (error) {
      this.logger.error('Error during shutdown', { error: error instanceof Error ? error.message : String(error) });
    }
    
    process.exit(0);
  }
}

// Create and start the application
const app = new DependencyApp();

// Graceful shutdown
process.on('SIGTERM', () => app.shutdown());
process.on('SIGINT', () => app.shutdown());

// Start the service
app.start().catch((error) => {
  console.error('Failed to start Dependency Service:', error);
  process.exit(1);
});

export default app;
