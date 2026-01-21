#!/usr/bin/env node
/**
 * LinkedIn OAuth Server
 * Run this, then open the URL in browser to authenticate
 */

const http = require('http');
const fs = require('fs');
const https = require('https');

const CREDENTIALS_PATH = '/root/.claude/secrets/linkedin.json';
const TOKENS_PATH = '/root/.claude/secrets/linkedin-tokens.json';
const PORT = 3000;

function getCredentials() {
  return JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
}

function saveTokens(tokens) {
  fs.writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
}

function getAuthUrl() {
  const creds = getCredentials();
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: creds.client_id,
    redirect_uri: creds.redirect_uri,
    state: require('crypto').randomBytes(16).toString('hex'),
    scope: 'openid profile email'
  });
  return `https://www.linkedin.com/oauth/v2/authorization?${params}`;
}

async function exchangeCode(code) {
  const creds = getCredentials();

  return new Promise((resolve, reject) => {
    const postData = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: creds.client_id,
      client_secret: creds.client_secret,
      redirect_uri: creds.redirect_uri
    }).toString();

    const req = https.request({
      hostname: 'www.linkedin.com',
      path: '/oauth/v2/accessToken',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) {
            reject(new Error(json.error_description || json.error));
          } else {
            resolve(json);
          }
        } catch (e) {
          reject(new Error('Invalid response: ' + data));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  console.log('Request:', url.pathname);

  if (url.pathname === '/callback') {
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');

    if (error) {
      res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<h1>Ошибка: ${error}</h1><p>${url.searchParams.get('error_description')}</p>`);
      return;
    }

    if (code) {
      try {
        console.log('Exchanging code for token...');
        const tokenData = await exchangeCode(code);

        const tokens = {
          access_token: tokenData.access_token,
          expires_at: Date.now() + (tokenData.expires_in * 1000),
          refresh_token: tokenData.refresh_token
        };

        saveTokens(tokens);

        console.log('SUCCESS! Token saved.');

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <html>
          <body style="font-family: system-ui; padding: 40px; text-align: center;">
            <h1 style="color: green;">✓ LinkedIn подключен!</h1>
            <p>Токен сохранен. Можешь закрыть это окно.</p>
            <p style="color: gray; font-size: 12px;">Expires: ${new Date(tokens.expires_at).toISOString()}</p>
          </body>
          </html>
        `);

        // Shutdown after success
        setTimeout(() => {
          console.log('Shutting down server...');
          server.close();
          process.exit(0);
        }, 2000);

      } catch (err) {
        console.error('Token exchange failed:', err);
        res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<h1>Ошибка</h1><pre>${err.message}</pre>`);
      }
      return;
    }
  }

  // Default: redirect to auth
  const authUrl = getAuthUrl();
  res.writeHead(302, { Location: authUrl });
  res.end();
});

server.listen(PORT, '0.0.0.0', () => {
  const authUrl = getAuthUrl();
  console.log('');
  console.log('='.repeat(60));
  console.log('LinkedIn OAuth Server');
  console.log('='.repeat(60));
  console.log('');
  console.log('Открой эту ссылку в браузере:');
  console.log('');
  console.log(`  http://167.99.210.229:${PORT}/`);
  console.log('');
  console.log('Или напрямую:');
  console.log('');
  console.log(`  ${authUrl}`);
  console.log('');
  console.log('Жду авторизацию...');
  console.log('');
});

// Timeout after 10 minutes
setTimeout(() => {
  console.log('Timeout - shutting down');
  server.close();
  process.exit(1);
}, 10 * 60 * 1000);
