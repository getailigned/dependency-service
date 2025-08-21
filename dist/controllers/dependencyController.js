"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DependencyController = void 0;
const loggerService_1 = require("../services/loggerService");
class DependencyController {
    constructor(dependencyService) {
        this.dependencyService = dependencyService;
        this.logger = new loggerService_1.LoggerService();
    }
    async createDependency(req, res) {
        try {
            const user = req.user;
            const data = req.body;
            if (!data.from_id || !data.to_id || !data.dependency_type) {
                res.status(400).json({
                    success: false,
                    error: 'MISSING_REQUIRED_FIELDS',
                    message: 'from_id, to_id, and dependency_type are required'
                });
                return;
            }
            const dependency = await this.dependencyService.createDependency(user, data);
            res.status(201).json({
                success: true,
                data: dependency
            });
        }
        catch (error) {
            this.handleError(res, error, 'Failed to create dependency');
        }
    }
    async updateDependency(req, res) {
        try {
            const user = req.user;
            const dependencyId = req.params.id;
            const data = req.body;
            if (!dependencyId) {
                res.status(400).json({
                    success: false,
                    error: 'MISSING_DEPENDENCY_ID',
                    message: 'Dependency ID is required'
                });
                return;
            }
            const dependency = await this.dependencyService.updateDependency(user, dependencyId, data);
            res.json({
                success: true,
                data: dependency
            });
        }
        catch (error) {
            this.handleError(res, error, 'Failed to update dependency');
        }
    }
    async deleteDependency(req, res) {
        try {
            const user = req.user;
            const dependencyId = req.params.id;
            if (!dependencyId) {
                res.status(400).json({
                    success: false,
                    error: 'MISSING_DEPENDENCY_ID',
                    message: 'Dependency ID is required'
                });
                return;
            }
            await this.dependencyService.deleteDependency(user, dependencyId);
            res.json({
                success: true,
                message: 'Dependency deleted successfully'
            });
        }
        catch (error) {
            this.handleError(res, error, 'Failed to delete dependency');
        }
    }
    async getDependency(req, res) {
        try {
            const user = req.user;
            const dependencyId = req.params.id;
            if (!dependencyId) {
                res.status(400).json({
                    success: false,
                    error: 'MISSING_DEPENDENCY_ID',
                    message: 'Dependency ID is required'
                });
                return;
            }
            const dependency = await this.dependencyService.getDependencyById(user, dependencyId);
            if (!dependency) {
                res.status(404).json({
                    success: false,
                    error: 'DEPENDENCY_NOT_FOUND',
                    message: 'Dependency not found'
                });
                return;
            }
            res.json({
                success: true,
                data: dependency
            });
        }
        catch (error) {
            this.handleError(res, error, 'Failed to get dependency');
        }
    }
    async getDependencyGraph(req, res) {
        try {
            const user = req.user;
            const workItemIds = req.query.work_item_ids
                ? req.query.work_item_ids.split(',')
                : undefined;
            const graph = await this.dependencyService.getDependencyGraph(user, workItemIds);
            res.json({
                success: true,
                data: graph
            });
        }
        catch (error) {
            this.handleError(res, error, 'Failed to get dependency graph');
        }
    }
    async getCriticalPath(req, res) {
        try {
            const user = req.user;
            const analysis = await this.dependencyService.getCriticalPathAnalysis(user);
            res.json({
                success: true,
                data: analysis
            });
        }
        catch (error) {
            this.handleError(res, error, 'Failed to get critical path analysis');
        }
    }
    async detectCycles(req, res) {
        try {
            const user = req.user;
            const cycles = await this.dependencyService.detectCyclesInTenant(user);
            res.json({
                success: true,
                data: cycles
            });
        }
        catch (error) {
            this.handleError(res, error, 'Failed to detect cycles');
        }
    }
    handleError(res, error, message) {
        this.logger.error(message, { error: error.message, stack: error.stack });
        let statusCode = 500;
        let errorCode = 'INTERNAL_ERROR';
        if (error.message.includes('CYCLE_DETECTED')) {
            statusCode = 409;
            errorCode = 'CYCLE_DETECTED';
        }
        else if (error.message.includes('NOT_FOUND')) {
            statusCode = 404;
            errorCode = 'NOT_FOUND';
        }
        else if (error.message.includes('DUPLICATE_DEPENDENCY')) {
            statusCode = 409;
            errorCode = 'DUPLICATE_DEPENDENCY';
        }
        else if (error.message.includes('WORK_ITEMS_NOT_FOUND')) {
            statusCode = 400;
            errorCode = 'WORK_ITEMS_NOT_FOUND';
        }
        else if (error.message.includes('INVALID_')) {
            statusCode = 400;
            errorCode = 'INVALID_REQUEST';
        }
        res.status(statusCode).json({
            success: false,
            error: errorCode,
            message: error.message || message,
            timestamp: new Date()
        });
    }
}
exports.DependencyController = DependencyController;
//# sourceMappingURL=dependencyController.js.map