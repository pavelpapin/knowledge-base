/**
 * Context Graph Types
 * Represents people, companies, and relationships
 */

export type EntityType = 'person' | 'company' | 'project' | 'topic';

export type RelationType =
  | 'works_at'       // person -> company
  | 'knows'          // person -> person
  | 'manages'        // person -> person
  | 'founded'        // person -> company
  | 'invested_in'    // person/company -> company
  | 'works_on'       // person -> project
  | 'part_of'        // project -> company
  | 'related_to'     // any -> any
  | 'mentioned_with' // any -> any (co-occurrence)
  | 'expert_in';     // person -> topic

export interface Entity {
  id: string;
  type: EntityType;
  name: string;
  aliases: string[];
  properties: Record<string, string | number | boolean>;
  notes: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
  lastMentioned?: string;
  mentionCount: number;
}

export interface Relation {
  id: string;
  type: RelationType;
  sourceId: string;
  targetId: string;
  properties: Record<string, string | number | boolean>;
  notes: string[];
  strength: number; // 0-1, how strong the relationship is
  createdAt: string;
  updatedAt: string;
}

export interface GraphStore {
  entities: Entity[];
  relations: Relation[];
}

export interface SearchResult {
  entity: Entity;
  score: number;
  matchedField: string;
}

export interface GraphStats {
  totalEntities: number;
  people: number;
  companies: number;
  projects: number;
  topics: number;
  totalRelations: number;
  recentlyMentioned: number;
}
