/**
 * Context Graph Store
 * Re-exports from modular store files
 */

export { loadStore, saveStore, getStats, exportGraph } from './store/base.js';
export {
  addEntity, updateEntity, touchEntity, getEntity, findEntityByName,
  searchEntities, getEntitiesByType, getRecentlyMentioned, getMostMentioned,
  getAllEntities, deleteEntity, addNote, addAlias
} from './store/entity.js';
export {
  addRelation, strengthenRelation, getRelationsFor, getConnections,
  deleteRelation, getAllRelations
} from './store/relation.js';
