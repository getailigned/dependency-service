"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoggerService = void 0;
const winston_1 = __importDefault(require("winston"));
class LoggerService {
    constructor() {
        this.logger = winston_1.default.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json(), winston_1.default.format.printf(({ timestamp, level, message, ...meta }) => {
                return JSON.stringify({
                    timestamp,
                    level,
                    service: 'dependency-service',
                    message,
                    ...meta
                });
            })),
            transports: [
                new winston_1.default.transports.Console({
                    format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple())
                })
            ]
        });
        if (process.env.NODE_ENV === 'production') {
            this.logger.add(new winston_1.default.transports.File({
                filename: 'logs/error.log',
                level: 'error'
            }));
            this.logger.add(new winston_1.default.transports.File({
                filename: 'logs/combined.log'
            }));
        }
    }
    debug(message, meta) {
        this.logger.debug(message, meta);
    }
    info(message, meta) {
        this.logger.info(message, meta);
    }
    warn(message, meta) {
        this.logger.warn(message, meta);
    }
    error(message, meta) {
        this.logger.error(message, meta);
    }
}
exports.LoggerService = LoggerService;
//# sourceMappingURL=loggerService.js.map