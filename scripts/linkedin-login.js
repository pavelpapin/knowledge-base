#!/usr/bin/env node
/**
 * LinkedIn Login Helper
 * Run: node /root/.claude/scripts/linkedin-login.js
 */

const { chromium } = require('playwright');
const { mkdirSync, existsSync } = require('fs');
const readline = require('readline');

const SESSION_DIR = '/root/.claude/secrets/linkedin-session';

async function main() {
  console.log('='.repeat(50));
  console.log('LinkedIn Login Helper');
  console.log('='.repeat(50));
  console.log('');

  if (!existsSync(SESSION_DIR)) {
    mkdirSync(SESSION_DIR, { recursive: true });
  }

  console.log('Launching browser...');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 50
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'en-US'
  });

  const page = await context.newPage();

  console.log('');
  console.log('Opening LinkedIn login page...');
  await page.goto('https://www.linkedin.com/login');

  console.log('');
  console.log('='.repeat(50));
  console.log('INSTRUCTIONS:');
  console.log('='.repeat(50));
  console.log('');
  console.log('1. Log in to LinkedIn in the browser window');
  console.log('2. Complete any 2FA/verification if required');
  console.log('3. Wait until you see your LinkedIn feed');
  console.log('4. Come back here and press ENTER to save session');
  console.log('');
  console.log('DO NOT close the browser window!');
  console.log('');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  await new Promise((resolve) => {
    rl.question('Press ENTER when logged in... ', () => {
      resolve();
    });
  });

  rl.close();

  const url = page.url();
  console.log('');
  console.log('Current URL:', url);

  if (url.includes('/feed') || url.includes('/in/') || url.includes('/mynetwork')) {
    console.log('✓ Logged in successfully!');
    console.log('Saving session...');
    await context.storageState({ path: `${SESSION_DIR}/state.json` });
    console.log('');
    console.log('='.repeat(50));
    console.log('SUCCESS! Session saved to:', `${SESSION_DIR}/state.json`);
    console.log('='.repeat(50));
  } else {
    console.log('⚠ Saving session anyway...');
    await context.storageState({ path: `${SESSION_DIR}/state.json` });
  }

  console.log('Closing browser...');
  await browser.close();
  console.log('Done!');
}

main().catch(e => { console.error(e); process.exit(1); });
