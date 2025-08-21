"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DependencyService = void 0;
const uuid_1 = require("uuid");
const loggerService_1 = require("./loggerService");
class DependencyService {
    constructor(db, messageQueue) {
        this.db = db;
        this.messageQueue = messageQueue;
        this.logger = new loggerService_1.LoggerService();
    }
    async createDependency(user, data) {
        return this.db.transaction(async (client) => {
            await this.validateWorkItemsExist(user, [data.from_id, data.to_id]);
            const cycleCheck = await this.wouldCreateCycle(user.tenant_id, data.from_id, data.to_id);
            if (cycleCheck.has_cycles) {
                throw new Error(`CYCLE_DETECTED: Creating this dependency would create a cycle: ${cycleCheck.cycles[0].join(' -> ')}`);
            }
            const existingQuery = `
        SELECT id FROM dependency_edges 
        WHERE tenant_id = $1 AND from_id = $2 AND to_id = $3;
      `;
            const existingResult = await client.query(existingQuery, [user.tenant_id, data.from_id, data.to_id]);
            if (existingResult.rows.length > 0) {
                throw new Error('DUPLICATE_DEPENDENCY: Dependency already exists between these work items');
            }
            const dependencyId = (0, uuid_1.v4)();
            const now = new Date();
            const insertQuery = `
        INSERT INTO dependency_edges (
          id, tenant_id, from_id, to_id, dependency_type, lag_days,
          created_at, created_by, updated_at, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *;
      `;
            const result = await client.query(insertQuery, [
                dependencyId,
                user.tenant_id,
                data.from_id,
                data.to_id,
                data.dependency_type,
                data.lag_days || 0,
                now,
                user.id,
                now,
                data.metadata || {}
            ]);
            const dependency = result.rows[0];
            await this.schedulePathRecalculation(user.tenant_id);
            await this.messageQueue.publish('dependencies', 'dependency.created', {
                type: 'created',
                dependency_id: dependencyId,
                tenant_id: user.tenant_id,
                user_id: user.id,
                data: dependency,
                timestamp: now
            });
            this.logger.info('Dependency created', {
                dependencyId,
                fromId: data.from_id,
                toId: data.to_id,
                type: data.dependency_type,
                userId: user.id,
                tenantId: user.tenant_id
            });
            return dependency;
        });
    }
    async updateDependency(user, dependencyId, data) {
        return this.db.transaction(async (client) => {
            const existing = await this.getDependencyById(user, dependencyId);
            if (!existing) {
                throw new Error('DEPENDENCY_NOT_FOUND');
            }
            const updates = [];
            const values = [];
            let paramIndex = 1;
            if (data.dependency_type !== undefined) {
                updates.push(`dependency_type = $${paramIndex++}`);
                values.push(data.dependency_type);
            }
            if (data.lag_days !== undefined) {
                updates.push(`lag_days = $${paramIndex++}`);
                values.push(data.lag_days);
            }
            if (data.metadata !== undefined) {
                updates.push(`metadata = $${paramIndex++}`);
                values.push(JSON.stringify(data.metadata));
            }
            if (updates.length === 0) {
                return existing;
            }
            updates.push(`updated_at = $${paramIndex++}`);
            values.push(new Date());
            values.push(dependencyId);
            values.push(user.tenant_id);
            const updateQuery = `
        UPDATE dependency_edges 
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex++} AND tenant_id = $${paramIndex}
        RETURNING *;
      `;
            const result = await client.query(updateQuery, values);
            const updatedDependency = result.rows[0];
            await this.schedulePathRecalculation(user.tenant_id);
            await this.messageQueue.publish('dependencies', 'dependency.updated', {
                type: 'updated',
                dependency_id: dependencyId,
                tenant_id: user.tenant_id,
                user_id: user.id,
                data: {
                    before: existing,
                    after: updatedDependency,
                    changes: data
                },
                timestamp: new Date()
            });
            this.logger.info('Dependency updated', {
                dependencyId,
                changes: Object.keys(data),
                userId: user.id,
                tenantId: user.tenant_id
            });
            return updatedDependency;
        });
    }
    async deleteDependency(user, dependencyId) {
        return this.db.transaction(async (client) => {
            const existing = await this.getDependencyById(user, dependencyId);
            if (!existing) {
                throw new Error('DEPENDENCY_NOT_FOUND');
            }
            const deleteQuery = `
        DELETE FROM dependency_edges 
        WHERE id = $1 AND tenant_id = $2;
      `;
            await client.query(deleteQuery, [dependencyId, user.tenant_id]);
            await this.schedulePathRecalculation(user.tenant_id);
            await this.messageQueue.publish('dependencies', 'dependency.deleted', {
                type: 'deleted',
                dependency_id: dependencyId,
                tenant_id: user.tenant_id,
                user_id: user.id,
                data: existing,
                timestamp: new Date()
            });
            this.logger.info('Dependency deleted', {
                dependencyId,
                fromId: existing.from_id,
                toId: existing.to_id,
                userId: user.id,
                tenantId: user.tenant_id
            });
        });
    }
    async getDependencyById(user, dependencyId) {
        const query = `
      SELECT * FROM dependency_edges 
      WHERE id = $1 AND tenant_id = $2;
    `;
        const result = await this.db.query(query, [dependencyId, user.tenant_id]);
        return result.rows.length > 0 ? result.rows[0] : null;
    }
    async getDependencyGraph(user, workItemIds) {
        const workItemsQuery = workItemIds
            ? `SELECT * FROM work_items WHERE tenant_id = $1 AND id = ANY($2::uuid[])`
            : `SELECT * FROM work_items WHERE tenant_id = $1`;
        const workItemsParams = workItemIds
            ? [user.tenant_id, workItemIds]
            : [user.tenant_id];
        const workItemsResult = await this.db.query(workItemsQuery, workItemsParams);
        const workItems = workItemsResult.rows;
        const dependenciesQuery = workItemIds
            ? `SELECT * FROM dependency_edges WHERE tenant_id = $1 AND (from_id = ANY($2::uuid[]) OR to_id = ANY($2::uuid[]))`
            : `SELECT * FROM dependency_edges WHERE tenant_id = $1`;
        const dependenciesParams = workItemIds
            ? [user.tenant_id, workItemIds]
            : [user.tenant_id];
        const dependenciesResult = await this.db.query(dependenciesQuery, dependenciesParams);
        const dependencies = dependenciesResult.rows;
        const graph = await this.buildDependencyGraph(workItems, dependencies);
        const criticalPath = this.calculateCriticalPath(graph);
        const cycleDetection = this.detectCycles(graph);
        return {
            nodes: graph.nodes,
            edges: graph.edges,
            critical_path: criticalPath.path,
            cycle_detected: cycleDetection.has_cycles,
            cycles: cycleDetection.cycles
        };
    }
    async getCriticalPathAnalysis(user) {
        const graph = await this.getDependencyGraph(user);
        const criticalPath = this.calculateCriticalPath(graph);
        const bottlenecks = this.identifyBottlenecks(graph);
        const riskScore = this.calculateRiskScore(graph);
        return {
            path: criticalPath.path,
            total_duration_days: criticalPath.total_duration_days,
            bottlenecks,
            risk_score: riskScore,
            completion_probability: this.estimateCompletionProbability(riskScore)
        };
    }
    async detectCyclesInTenant(user) {
        const graph = await this.getDependencyGraph(user);
        return this.detectCycles(graph);
    }
    async buildDependencyGraph(workItems, dependencies) {
        const nodes = workItems.map(item => ({
            id: item.id,
            title: item.title,
            type: item.type,
            status: item.status,
            duration_days: item.estimated_duration_days || this.estimateDuration(item),
            is_critical: false
        }));
        const edges = dependencies.map(dep => ({
            id: dep.id,
            from: dep.from_id,
            to: dep.to_id,
            type: dep.dependency_type,
            lag_days: dep.lag_days,
            is_critical: false
        }));
        return {
            nodes,
            edges,
            critical_path: [],
            cycle_detected: false
        };
    }
    calculateCriticalPath(graph) {
        const nodeMap = new Map(graph.nodes.map(n => [n.id, n]));
        const adjacencyList = new Map();
        const reverseAdjacencyList = new Map();
        graph.nodes.forEach(node => {
            adjacencyList.set(node.id, []);
            reverseAdjacencyList.set(node.id, []);
        });
        graph.edges.forEach(edge => {
            adjacencyList.get(edge.from)?.push(edge.to);
            reverseAdjacencyList.get(edge.to)?.push(edge.from);
        });
        const earliestStart = new Map();
        const earliestFinish = new Map();
        const forwardPass = (nodeId) => {
            if (earliestFinish.has(nodeId)) {
                return earliestFinish.get(nodeId);
            }
            const node = nodeMap.get(nodeId);
            const predecessors = reverseAdjacencyList.get(nodeId) || [];
            let maxPredecessorFinish = 0;
            for (const predId of predecessors) {
                const predFinish = forwardPass(predId);
                const edge = graph.edges.find(e => e.from === predId && e.to === nodeId);
                const lagDays = edge ? edge.lag_days : 0;
                maxPredecessorFinish = Math.max(maxPredecessorFinish, predFinish + lagDays);
            }
            earliestStart.set(nodeId, maxPredecessorFinish);
            const finish = maxPredecessorFinish + node.duration_days;
            earliestFinish.set(nodeId, finish);
            return finish;
        };
        graph.nodes.forEach(node => forwardPass(node.id));
        const projectCompletion = Math.max(...Array.from(earliestFinish.values()));
        const latestStart = new Map();
        const latestFinish = new Map();
        const backwardPass = (nodeId) => {
            if (latestStart.has(nodeId)) {
                return latestStart.get(nodeId);
            }
            const node = nodeMap.get(nodeId);
            const successors = adjacencyList.get(nodeId) || [];
            let minSuccessorStart = projectCompletion;
            if (successors.length === 0) {
                minSuccessorStart = earliestFinish.get(nodeId);
            }
            else {
                for (const succId of successors) {
                    const succStart = backwardPass(succId);
                    const edge = graph.edges.find(e => e.from === nodeId && e.to === succId);
                    const lagDays = edge ? edge.lag_days : 0;
                    minSuccessorStart = Math.min(minSuccessorStart, succStart - lagDays);
                }
            }
            latestFinish.set(nodeId, minSuccessorStart);
            const start = minSuccessorStart - node.duration_days;
            latestStart.set(nodeId, start);
            return start;
        };
        graph.nodes.forEach(node => backwardPass(node.id));
        const criticalNodes = [];
        graph.nodes.forEach(node => {
            const earliestS = earliestStart.get(node.id);
            const latestS = latestStart.get(node.id);
            const slack = latestS - earliestS;
            node.earliest_start = new Date(Date.now() + earliestS * 24 * 60 * 60 * 1000);
            node.earliest_finish = new Date(Date.now() + earliestFinish.get(node.id) * 24 * 60 * 60 * 1000);
            node.latest_start = new Date(Date.now() + latestS * 24 * 60 * 60 * 1000);
            node.latest_finish = new Date(Date.now() + latestFinish.get(node.id) * 24 * 60 * 60 * 1000);
            node.slack_days = slack;
            node.is_critical = slack === 0;
            if (slack === 0) {
                criticalNodes.push(node.id);
            }
        });
        graph.edges.forEach(edge => {
            const fromNode = nodeMap.get(edge.from);
            const toNode = nodeMap.get(edge.to);
            edge.is_critical = fromNode.is_critical && toNode.is_critical;
        });
        return {
            path: criticalNodes,
            total_duration_days: projectCompletion,
            bottlenecks: [],
            risk_score: 0,
            completion_probability: 0
        };
    }
    detectCycles(graph) {
        const visited = new Set();
        const recursionStack = new Set();
        const cycles = [];
        const adjacencyList = new Map();
        graph.nodes.forEach(node => adjacencyList.set(node.id, []));
        graph.edges.forEach(edge => {
            adjacencyList.get(edge.from)?.push(edge.to);
        });
        const dfs = (nodeId, path) => {
            visited.add(nodeId);
            recursionStack.add(nodeId);
            path.push(nodeId);
            const neighbors = adjacencyList.get(nodeId) || [];
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    if (dfs(neighbor, [...path])) {
                        return true;
                    }
                }
                else if (recursionStack.has(neighbor)) {
                    const cycleStart = path.indexOf(neighbor);
                    const cycle = path.slice(cycleStart).concat(neighbor);
                    cycles.push(cycle);
                    return true;
                }
            }
            recursionStack.delete(nodeId);
            return false;
        };
        for (const node of graph.nodes) {
            if (!visited.has(node.id)) {
                dfs(node.id, []);
            }
        }
        const affectedItems = new Set();
        cycles.forEach(cycle => cycle.forEach(item => affectedItems.add(item)));
        return {
            has_cycles: cycles.length > 0,
            cycles,
            affected_work_items: Array.from(affectedItems),
            resolution_suggestions: this.generateCycleResolutions(cycles)
        };
    }
    identifyBottlenecks(graph) {
        const bottlenecks = [];
        graph.nodes.forEach(node => {
            if (node.is_critical && node.slack_days === 0) {
                const incomingEdges = graph.edges.filter(e => e.to === node.id);
                const outgoingEdges = graph.edges.filter(e => e.from === node.id);
                const riskFactors = [];
                if (incomingEdges.length > 3)
                    riskFactors.push('High dependency count');
                if (outgoingEdges.length > 3)
                    riskFactors.push('Blocks many items');
                if (node.status === 'blocked')
                    riskFactors.push('Currently blocked');
                if (node.duration_days > 30)
                    riskFactors.push('Long duration');
                if (riskFactors.length > 0) {
                    bottlenecks.push({
                        work_item_id: node.id,
                        title: node.title,
                        delay_impact_days: node.duration_days,
                        risk_factors: riskFactors,
                        mitigation_suggestions: this.generateMitigationSuggestions(node, riskFactors)
                    });
                }
            }
        });
        return bottlenecks.sort((a, b) => b.delay_impact_days - a.delay_impact_days);
    }
    calculateRiskScore(graph) {
        let riskScore = 0;
        const criticalNodes = graph.nodes.filter(n => n.is_critical);
        const blockedNodes = graph.nodes.filter(n => n.status === 'blocked');
        const longDurationNodes = graph.nodes.filter(n => n.duration_days > 30);
        riskScore += criticalNodes.length * 0.3;
        riskScore += blockedNodes.length * 0.5;
        riskScore += longDurationNodes.length * 0.2;
        return Math.min(riskScore / graph.nodes.length, 1);
    }
    estimateCompletionProbability(riskScore) {
        return Math.max(0.1, 1 - riskScore);
    }
    estimateDuration(workItem) {
        const baseDurations = {
            'objective': 90,
            'strategy': 60,
            'initiative': 30,
            'task': 7,
            'subtask': 3
        };
        return baseDurations[workItem.type] || 7;
    }
    generateCycleResolutions(cycles) {
        const suggestions = [];
        cycles.forEach((cycle, index) => {
            suggestions.push(`Cycle ${index + 1}: Consider removing dependency between ${cycle[cycle.length - 2]} and ${cycle[cycle.length - 1]}`);
            suggestions.push(`Cycle ${index + 1}: Alternative - Split work item ${cycle[0]} to break the cycle`);
        });
        return suggestions;
    }
    generateMitigationSuggestions(_node, riskFactors) {
        const suggestions = [];
        if (riskFactors.includes('High dependency count')) {
            suggestions.push('Consider parallel execution of dependent tasks');
        }
        if (riskFactors.includes('Long duration')) {
            suggestions.push('Break down into smaller tasks');
            suggestions.push('Add intermediate milestones');
        }
        if (riskFactors.includes('Currently blocked')) {
            suggestions.push('Escalate blocker resolution');
            suggestions.push('Identify alternative approaches');
        }
        return suggestions;
    }
    async wouldCreateCycle(tenantId, fromId, toId) {
        const pathQuery = `
      WITH RECURSIVE dependency_path AS (
        SELECT from_id, to_id, 1 as depth
        FROM dependency_edges
        WHERE tenant_id = $1 AND from_id = $2
        
        UNION ALL
        
        SELECT de.from_id, de.to_id, dp.depth + 1
        FROM dependency_edges de
        JOIN dependency_path dp ON de.from_id = dp.to_id
        WHERE de.tenant_id = $1 AND dp.depth < 20
      )
      SELECT EXISTS(
        SELECT 1 FROM dependency_path WHERE to_id = $3
      ) as would_cycle;
    `;
        const result = await this.db.query(pathQuery, [tenantId, toId, fromId]);
        const wouldCycle = result.rows[0]?.would_cycle || false;
        return {
            has_cycles: wouldCycle,
            cycles: wouldCycle ? [[toId, fromId]] : [],
            affected_work_items: wouldCycle ? [fromId, toId] : [],
            resolution_suggestions: wouldCycle ? ['Remove existing path or choose different dependency'] : []
        };
    }
    async validateWorkItemsExist(user, workItemIds) {
        const query = `
      SELECT id FROM work_items 
      WHERE tenant_id = $1 AND id = ANY($2::uuid[]);
    `;
        const result = await this.db.query(query, [user.tenant_id, workItemIds]);
        const foundIds = result.rows.map((row) => row.id);
        const missingIds = workItemIds.filter(id => !foundIds.includes(id));
        if (missingIds.length > 0) {
            throw new Error(`WORK_ITEMS_NOT_FOUND: ${missingIds.join(', ')}`);
        }
    }
    async schedulePathRecalculation(tenantId) {
        await this.messageQueue.publish('system', 'critical_path.recalculate', {
            tenant_id: tenantId,
            timestamp: new Date()
        });
    }
}
exports.DependencyService = DependencyService;
//# sourceMappingURL=dependencyService.js.map