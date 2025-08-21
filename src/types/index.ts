// Dependency Service Types

export interface Dependency {
  id: string;
  tenant_id: string;
  from_id: string;
  to_id: string;
  dependency_type: DependencyType;
  lag_days: number;
  created_at: Date;
  created_by: string;
  updated_at: Date;
  metadata?: Record<string, any>;
}

export enum DependencyType {
  FINISH_TO_START = 'finish_to_start',   // FS: predecessor must finish before successor starts
  START_TO_START = 'start_to_start',     // SS: predecessor must start before successor starts
  FINISH_TO_FINISH = 'finish_to_finish', // FF: predecessor must finish before successor finishes
  START_TO_FINISH = 'start_to_finish'    // SF: predecessor must start before successor finishes
}

export interface CreateDependencyRequest {
  from_id: string;
  to_id: string;
  dependency_type: DependencyType;
  lag_days?: number;
  metadata?: Record<string, any>;
}

export interface UpdateDependencyRequest {
  dependency_type?: DependencyType;
  lag_days?: number;
  metadata?: Record<string, any>;
}

export interface DependencyGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  critical_path: string[];
  cycle_detected: boolean;
  cycles?: string[][];
}

export interface GraphNode {
  id: string;
  title: string;
  type: string;
  status: string;
  duration_days?: number;
  earliest_start?: Date;
  earliest_finish?: Date;
  latest_start?: Date;
  latest_finish?: Date;
  slack_days?: number;
  is_critical: boolean;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  type: DependencyType;
  lag_days: number;
  is_critical: boolean;
}

export interface CriticalPathAnalysis {
  path: string[];
  total_duration_days: number;
  bottlenecks: Bottleneck[];
  risk_score: number;
  completion_probability: number;
}

export interface Bottleneck {
  work_item_id: string;
  title: string;
  delay_impact_days: number;
  risk_factors: string[];
  mitigation_suggestions: string[];
}

export interface CycleDetectionResult {
  has_cycles: boolean;
  cycles: string[][];
  affected_work_items: string[];
  resolution_suggestions: string[];
}

export interface WorkItem {
  id: string;
  tenant_id: string;
  type: string;
  title: string;
  status: string;
  priority: string;
  owner_id: string;
  due_at?: Date;
  started_at?: Date;
  completed_at?: Date;
  estimated_duration_days?: number;
}

export interface User {
  id: string;
  email: string;
  tenant_id: string;
  roles: string[];
}

export interface DependencyEvent {
  type: string;
  dependency_id: string;
  tenant_id: string;
  user_id: string;
  data: Record<string, any>;
  timestamp: Date;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface CriticalPathMetrics {
  longest_path_days: number;
  total_work_items: number;
  critical_work_items: number;
  completion_date: Date;
  risk_factors: {
    high_risk_items: number;
    blocked_items: number;
    overdue_items: number;
  };
}

export interface DatabaseConnection {
  query: (text: string, params?: any[]) => Promise<any>;
  transaction: <T>(callback: (client: any) => Promise<T>) => Promise<T>;
}

export interface MessageQueueConnection {
  publish: (exchange: string, routingKey: string, message: any) => Promise<void>;
  subscribe: (queue: string, callback: (message: any) => void) => Promise<void>;
}
