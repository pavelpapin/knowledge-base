/**
 * List and info commands
 */

import * as store from '../store.js';
import { printEntity } from './utils.js';

export function people(): void {
  const list = store.getEntitiesByType('person');
  console.log('\n👥 People');
  console.log('=========');
  if (list.length === 0) {
    console.log('No people yet');
  } else {
    list.forEach(printEntity);
  }
}

export function companies(): void {
  const list = store.getEntitiesByType('company');
  console.log('\n🏢 Companies');
  console.log('============');
  if (list.length === 0) {
    console.log('No companies yet');
  } else {
    list.forEach(printEntity);
  }
}

export function recent(args: string[]): void {
  const limit = parseInt(args[0]) || 10;
  const list = store.getRecentlyMentioned(limit);
  console.log('\n🕐 Recently Mentioned');
  console.log('====================');
  if (list.length === 0) {
    console.log('No recent mentions');
  } else {
    list.forEach(printEntity);
  }
}

export function top(args: string[]): void {
  const limit = parseInt(args[0]) || 10;
  const list = store.getMostMentioned(limit);
  console.log('\n🔥 Most Mentioned');
  console.log('=================');
  if (list.length === 0) {
    console.log('No entities yet');
  } else {
    list.forEach(printEntity);
  }
}

export function stats(): void {
  const s = store.getStats();
  console.log('\n📊 Context Graph Stats');
  console.log('======================');
  console.log(`Total entities: ${s.totalEntities}`);
  console.log(`  👤 People:    ${s.people}`);
  console.log(`  🏢 Companies: ${s.companies}`);
  console.log(`  📁 Projects:  ${s.projects}`);
  console.log(`  💡 Topics:    ${s.topics}`);
  console.log(`Total relations: ${s.totalRelations}`);
  console.log(`Recently mentioned (24h): ${s.recentlyMentioned}`);
}

export function json(): void {
  const graph = store.exportGraph();
  console.log(JSON.stringify(graph, null, 2));
}
