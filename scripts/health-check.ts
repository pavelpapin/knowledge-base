#!/usr/bin/env npx ts-node
/**
 * Health Check CLI
 * Quick verification that Elio OS is working
 *
 * Usage: npx ts-node scripts/health-check.ts
 *        pnpm health-check
 */

import { runHealthChecks, printHealthReport } from '../packages/workflow/src/health/index.js'
import { closeAllConnections } from '../packages/workflow/src/index.js'

async function main(): Promise<void> {
  console.log('Running Elio OS health checks...\n')

  try {
    const health = await runHealthChecks()
    printHealthReport(health)

    // Exit with appropriate code
    if (health.status === 'unhealthy') {
      console.error('FAILED: System is unhealthy')
      process.exit(1)
    } else if (health.status === 'degraded') {
      console.warn('WARNING: System is degraded')
      process.exit(0)
    } else {
      console.log('SUCCESS: System is healthy')
      process.exit(0)
    }
  } catch (err) {
    console.error('FATAL: Health check failed to run')
    console.error(err)
    process.exit(2)
  } finally {
    await closeAllConnections()
  }
}

main()
