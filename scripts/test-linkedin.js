const { chromium } = require('playwright');

async function test() {
  console.log('Testing LinkedIn session...');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: '/root/.claude/secrets/linkedin-session/state.json',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  const page = await context.newPage();

  // Test: go to a profile
  console.log('Navigating to profile...');
  await page.goto('https://www.linkedin.com/in/winstonweinberg/', {
    waitUntil: 'networkidle',
    timeout: 30000
  });

  // Wait a bit for any redirects
  await page.waitForTimeout(2000);

  const url = page.url();
  console.log('Final URL:', url);

  if (url.includes('/authwall') || url.includes('/login') || url.includes('/checkpoint')) {
    console.log('');
    console.log('FAIL: Session not valid, redirected to login/authwall');
    console.log('');
  } else if (url.includes('/in/')) {
    console.log('');
    console.log('SUCCESS: Session works!');
    console.log('');

    // Try to get name
    try {
      await page.waitForSelector('h1', { timeout: 5000 });
      const name = await page.$eval('h1', el => el.textContent);
      console.log('Profile name:', name.trim());
    } catch (e) {
      console.log('Could not extract name');
    }

    // Get page title
    const title = await page.title();
    console.log('Page title:', title);
  } else {
    console.log('Unknown state, URL:', url);
  }

  await browser.close();
}

test().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
