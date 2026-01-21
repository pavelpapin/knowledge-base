#!/usr/bin/env node
/**
 * LinkedIn Cookie Login
 *
 * Since we can't open a GUI browser, you'll need to:
 * 1. Log in to LinkedIn in your local browser
 * 2. Export cookies using an extension (e.g., EditThisCookie)
 * 3. Paste the li_at cookie value when prompted
 *
 * Run: node /root/.claude/scripts/linkedin-cookie-login.js
 */

const { chromium } = require('playwright');
const { mkdirSync, existsSync, writeFileSync } = require('fs');
const readline = require('readline');

const SESSION_DIR = '/root/.claude/secrets/linkedin-session';

async function main() {
  console.log('='.repeat(60));
  console.log('LinkedIn Cookie Login');
  console.log('='.repeat(60));
  console.log('');
  console.log('Since this server has no GUI, you need to provide cookies');
  console.log('from your local browser.');
  console.log('');
  console.log('INSTRUCTIONS:');
  console.log('='.repeat(60));
  console.log('');
  console.log('1. Open LinkedIn in your browser and log in');
  console.log('2. Open Developer Tools (F12) -> Application -> Cookies');
  console.log('3. Find the cookie named "li_at"');
  console.log('4. Copy its value (a long string starting with AQ...)');
  console.log('5. Paste it below');
  console.log('');
  console.log('Alternative: Use browser extension like "EditThisCookie"');
  console.log('to export all cookies as JSON.');
  console.log('');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const liAt = await new Promise((resolve) => {
    rl.question('Paste li_at cookie value: ', (answer) => {
      resolve(answer.trim());
    });
  });

  if (!liAt || liAt.length < 50) {
    console.log('');
    console.log('ERROR: Invalid cookie value. Must be a long string.');
    rl.close();
    process.exit(1);
  }

  // Optionally get JSESSIONID
  const jsessionid = await new Promise((resolve) => {
    rl.question('Paste JSESSIONID (optional, press Enter to skip): ', (answer) => {
      resolve(answer.trim());
    });
  });

  rl.close();

  // Create session directory
  if (!existsSync(SESSION_DIR)) {
    mkdirSync(SESSION_DIR, { recursive: true });
  }

  console.log('');
  console.log('Creating session state...');

  // Build cookies array
  const cookies = [
    {
      name: 'li_at',
      value: liAt,
      domain: '.linkedin.com',
      path: '/',
      expires: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60, // 1 year
      httpOnly: true,
      secure: true,
      sameSite: 'None'
    },
    {
      name: 'lidc',
      value: 'b=VGST00:s=V:r=V:a=V:p=V:g=3466:u=1:x=1:i=1705847400:t=1705933800:v=2:sig=AQHVqZqZqZqZqZqZqZqZqZqZqZqZqZqZ',
      domain: '.linkedin.com',
      path: '/',
      expires: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
      httpOnly: false,
      secure: true,
      sameSite: 'None'
    }
  ];

  if (jsessionid) {
    cookies.push({
      name: 'JSESSIONID',
      value: jsessionid.startsWith('"') ? jsessionid : `"${jsessionid}"`,
      domain: '.linkedin.com',
      path: '/',
      expires: -1,
      httpOnly: false,
      secure: true,
      sameSite: 'None'
    });
  }

  // Build state object
  const state = {
    cookies: cookies,
    origins: [
      {
        origin: 'https://www.linkedin.com',
        localStorage: []
      }
    ]
  };

  // Save state
  const statePath = `${SESSION_DIR}/state.json`;
  writeFileSync(statePath, JSON.stringify(state, null, 2));

  console.log('');
  console.log('Session saved to:', statePath);
  console.log('');

  // Verify by making a test request
  console.log('Verifying session...');

  try {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      storageState: statePath,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded' });

    const url = page.url();
    const title = await page.title();

    await browser.close();

    if (url.includes('/feed') || url.includes('/in/')) {
      console.log('');
      console.log('='.repeat(60));
      console.log('SUCCESS! Session is valid.');
      console.log('='.repeat(60));
      console.log('');
      console.log('Page title:', title);
      console.log('URL:', url);
      console.log('');
      console.log('You can now use the LinkedIn scraper.');
    } else if (url.includes('/authwall') || url.includes('/login')) {
      console.log('');
      console.log('WARNING: Session verification failed.');
      console.log('The cookie might be expired or invalid.');
      console.log('URL:', url);
    } else {
      console.log('');
      console.log('Session saved. Please test the scraper to verify.');
      console.log('URL:', url);
    }
  } catch (error) {
    console.log('');
    console.log('Could not verify (but session is saved):', error.message);
    console.log('Try using the scraper directly to test.');
  }

  console.log('');
  console.log('Done!');
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
