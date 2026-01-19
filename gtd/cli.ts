/**
 * GTD CLI Interface
 */

import * as store from './store.js';
import { TaskStatus, TaskPriority, Project } from './types.js';

const command = process.argv[2];
const args = process.argv.slice(3);

function printTask(task: ReturnType<typeof store.getAllTasks>[0]): void {
  const priority = task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢';
  const due = task.dueDate ? ` [Due: ${task.dueDate}]` : '';
  const waiting = task.waitingFor ? ` [Waiting: ${task.waitingFor}]` : '';
  console.log(`${priority} ${task.id.substring(0, 8)} | ${task.title}${due}${waiting}`);
}

function printStats(): void {
  const stats = store.getStats();
  console.log('\n📊 GTD Dashboard');
  console.log('================');
  console.log(`📥 Inbox:    ${stats.inbox}`);
  console.log(`⚡ Next:     ${stats.next}`);
  console.log(`⏳ Waiting:  ${stats.waiting}`);
  console.log(`📁 Projects: ${stats.projects}`);
  console.log(`⚠️  Overdue:  ${stats.overdue}`);
}

switch (command) {
  case 'add':
  case 'capture': {
    const title = args.join(' ');
    if (!title) {
      console.error('Usage: gtd add <title>');
      process.exit(1);
    }
    const task = store.addTask(title);
    console.log(`✅ Added to inbox: ${task.id.substring(0, 8)}`);
    break;
  }

  case 'inbox': {
    const tasks = store.getInbox();
    console.log('\n📥 Inbox');
    console.log('========');
    if (tasks.length === 0) {
      console.log('Empty! 🎉');
    } else {
      tasks.forEach(printTask);
    }
    break;
  }

  case 'next': {
    const tasks = store.getNextActions();
    console.log('\n⚡ Next Actions');
    console.log('===============');
    if (tasks.length === 0) {
      console.log('No next actions. Process your inbox!');
    } else {
      tasks.forEach(printTask);
    }
    break;
  }

  case 'waiting': {
    const tasks = store.getWaiting();
    console.log('\n⏳ Waiting For');
    console.log('==============');
    if (tasks.length === 0) {
      console.log('Nothing pending.');
    } else {
      tasks.forEach(printTask);
    }
    break;
  }

  case 'due': {
    const tasks = store.getDueTasks();
    console.log('\n⚠️ Due/Overdue');
    console.log('==============');
    if (tasks.length === 0) {
      console.log('Nothing due!');
    } else {
      tasks.forEach(printTask);
    }
    break;
  }

  case 'projects': {
    const projects = store.getActiveProjects();
    console.log('\n📁 Active Projects');
    console.log('==================');
    if (projects.length === 0) {
      console.log('No active projects.');
    } else {
      projects.forEach((p: Project) => {
        console.log(`${p.id.substring(0, 8)} | ${p.name}`);
        console.log(`   Outcome: ${p.outcome}`);
      });
    }
    break;
  }

  case 'do':
  case 'done': {
    const id = args[0];
    if (!id) {
      console.error('Usage: gtd done <task-id>');
      process.exit(1);
    }
    const tasks = store.getAllTasks();
    const task = tasks.find(t => t.id.startsWith(id));
    if (!task) {
      console.error('Task not found');
      process.exit(1);
    }
    store.updateTask(task.id, { status: 'done' });
    console.log(`✅ Completed: ${task.title}`);
    break;
  }

  case 'move': {
    const [id, status] = args;
    if (!id || !status) {
      console.error('Usage: gtd move <task-id> <status>');
      console.error('Status: inbox, next, waiting, scheduled, someday, done');
      process.exit(1);
    }
    const tasks = store.getAllTasks();
    const task = tasks.find(t => t.id.startsWith(id));
    if (!task) {
      console.error('Task not found');
      process.exit(1);
    }
    store.updateTask(task.id, { status: status as TaskStatus });
    console.log(`➡️ Moved to ${status}: ${task.title}`);
    break;
  }

  case 'priority': {
    const [id, priority] = args;
    if (!id || !priority) {
      console.error('Usage: gtd priority <task-id> <high|medium|low>');
      process.exit(1);
    }
    const tasks = store.getAllTasks();
    const task = tasks.find(t => t.id.startsWith(id));
    if (!task) {
      console.error('Task not found');
      process.exit(1);
    }
    store.updateTask(task.id, { priority: priority as TaskPriority });
    console.log(`🎯 Priority set: ${task.title} -> ${priority}`);
    break;
  }

  case 'project': {
    const [name, ...outcomeWords] = args;
    if (!name || outcomeWords.length === 0) {
      console.error('Usage: gtd project <name> <outcome description>');
      process.exit(1);
    }
    const project = store.addProject(name, outcomeWords.join(' '));
    console.log(`📁 Project created: ${project.id.substring(0, 8)}`);
    break;
  }

  case 'stats':
  case 'dashboard':
    printStats();
    break;

  case 'all': {
    const tasks = store.getAllTasks().filter(t => t.status !== 'done');
    console.log('\n📋 All Active Tasks');
    console.log('===================');
    tasks.forEach(t => {
      console.log(`[${t.status}] ${t.id.substring(0, 8)} | ${t.title}`);
    });
    break;
  }

  case 'json': {
    console.log(JSON.stringify({
      stats: store.getStats(),
      inbox: store.getInbox(),
      next: store.getNextActions(),
      waiting: store.getWaiting(),
      due: store.getDueTasks(),
      projects: store.getActiveProjects()
    }, null, 2));
    break;
  }

  default:
    console.log(`
GTD System - Getting Things Done

Usage: gtd <command> [args]

Commands:
  add <title>           Add task to inbox
  inbox                 Show inbox
  next                  Show next actions
  waiting               Show waiting for
  due                   Show due/overdue
  projects              Show active projects
  done <id>             Mark task complete
  move <id> <status>    Move task to status
  priority <id> <p>     Set priority (high/medium/low)
  project <name> <out>  Create project
  stats                 Show dashboard
  all                   Show all active tasks
  json                  Export as JSON
`);
}
