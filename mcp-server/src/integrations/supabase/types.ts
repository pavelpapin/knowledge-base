/**
 * Supabase Types
 * Database schema types for Elio state management
 */

// Workflow run status
export type RunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

// Schedule frequency
export type ScheduleFrequency = 'once' | 'hourly' | 'daily' | 'weekly' | 'cron';

// Message source
export type MessageSource = 'telegram' | 'email' | 'slack' | 'web';

// Task priority
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

// Workflow run record
export interface WorkflowRun {
  id: string;
  workflow_name: string;
  trigger: string;
  status: RunStatus;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
  created_at: string;
}

// Scheduled task record
export interface ScheduledTask {
  id: string;
  name: string;
  workflow_name: string;
  frequency: ScheduleFrequency;
  cron_expression?: string;
  next_run_at: string;
  last_run_at?: string;
  last_run_id?: string;
  enabled: boolean;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// Message record (inbox)
export interface Message {
  id: string;
  source: MessageSource;
  external_id: string;
  sender: string;
  content: string;
  metadata: Record<string, unknown>;
  processed: boolean;
  processed_at?: string;
  action_taken?: string;
  created_at: string;
}

// Task record (GTD)
export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: 'inbox' | 'next' | 'waiting' | 'someday' | 'done';
  context?: string;
  project?: string;
  due_date?: string;
  scheduled_date?: string;
  completed_at?: string;
  source_message_id?: string;
  created_at: string;
  updated_at: string;
}

// Person record (CRM)
export interface Person {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  role?: string;
  linkedin_url?: string;
  telegram_id?: string;
  notes?: string;
  tags: string[];
  last_contact_at?: string;
  created_at: string;
  updated_at: string;
}

// Conversation memory
export interface ConversationMemory {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

// System state
export interface SystemState {
  key: string;
  value: unknown;
  updated_at: string;
}

// Database schema for Supabase
export interface Database {
  public: {
    Tables: {
      workflow_runs: {
        Row: WorkflowRun;
        Insert: Omit<WorkflowRun, 'id' | 'created_at'>;
        Update: Partial<Omit<WorkflowRun, 'id' | 'created_at'>>;
      };
      scheduled_tasks: {
        Row: ScheduledTask;
        Insert: Omit<ScheduledTask, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<ScheduledTask, 'id' | 'created_at'>>;
      };
      messages: {
        Row: Message;
        Insert: Omit<Message, 'id' | 'created_at'>;
        Update: Partial<Omit<Message, 'id' | 'created_at'>>;
      };
      tasks: {
        Row: Task;
        Insert: Omit<Task, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Task, 'id' | 'created_at'>>;
      };
      people: {
        Row: Person;
        Insert: Omit<Person, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Person, 'id' | 'created_at'>>;
      };
      conversation_memory: {
        Row: ConversationMemory;
        Insert: Omit<ConversationMemory, 'id' | 'created_at'>;
        Update: Partial<Omit<ConversationMemory, 'id' | 'created_at'>>;
      };
      system_state: {
        Row: SystemState;
        Insert: SystemState;
        Update: Partial<SystemState>;
      };
    };
  };
}
