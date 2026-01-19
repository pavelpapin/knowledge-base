/**
 * GTD System Types
 */

export type TaskStatus = 'inbox' | 'next' | 'waiting' | 'scheduled' | 'someday' | 'done';
export type TaskPriority = 'high' | 'medium' | 'low';
export type TaskContext = '@computer' | '@phone' | '@errands' | '@home' | '@office' | '@anywhere';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  context?: TaskContext;
  project?: string;
  dueDate?: string;
  scheduledDate?: string;
  waitingFor?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  notes?: string[];
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  outcome: string;
  status: 'active' | 'on-hold' | 'completed';
  tasks: string[];
  createdAt: string;
  updatedAt: string;
}

export interface GTDStore {
  tasks: Task[];
  projects: Project[];
  lastReview?: string;
}

export interface WeeklyReview {
  date: string;
  inboxCleared: boolean;
  projectsReviewed: string[];
  nextActionsUpdated: boolean;
  somedayReviewed: boolean;
  notes: string;
}
