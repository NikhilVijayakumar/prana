import http from 'node:http';
import { exec } from 'node:child_process';

export interface OAuthCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  adminEmail: string;
  accessToken?: string; // Optional temporary store if needed
}

export const launchOAuthCallback = (
  clientId: string,
  clientSecret: string,
  port: number = 3111
): Promise<OAuthCredentials> => {
  return new Promise((resolve, reject) => {
    const redirectUri = `http://localhost:${port}/auth/callback`;
    
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url || '', `http://localhost:${port}`);
      
      if (url.pathname === '/auth/callback') {
        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<h1>Auth Failed</h1><p>Check console.</p>');
          server.close();
          reject(new Error(`OAuth Error: ${error}`));
          return;
        }

        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end('<h1>Invalid Request</h1><p>No code found.</p>');
          server.close();
          reject(new Error('No code parameter found in callback URL.'));
          return;
        }

        try {
          // 1. Exchange code for tokens
          const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              code,
              client_id: clientId,
              client_secret: clientSecret,
              redirect_uri: redirectUri,
              grant_type: 'authorization_code',
            }).toString(),
          });
          
          const tokenData = await tokenRes.json();
          if (!tokenData.access_token || !tokenData.refresh_token) {
            throw new Error(`Failed to exchange token: ${JSON.stringify(tokenData)}`);
          }

          // 2. Fetch User Info for adminEmail
          const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
          });
          const userData = await userRes.json();
          const adminEmail = userData.email || 'unknown@example.com';

          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<h1>Success!</h1><p>You can close this window and return to Prana.</p><script>window.close()</script>');
          
          server.close(() => {
            resolve({
              clientId,
              clientSecret,
              refreshToken: tokenData.refresh_token,
              adminEmail,
              accessToken: tokenData.access_token,
            });
          });
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end('<h1>Server Error</h1><p>Failed to resolve Google auth.</p>');
          server.close();
          reject(err);
        }
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    server.listen(port, 'localhost', () => {
      // Prompt OS to open Chromium/Default Browser natively
      const scopes = [
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/forms.responses.readonly',
        'https://www.googleapis.com/auth/spreadsheets.readonly'
      ].join(' ');
      
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=http://localhost:${port}/auth/callback&response_type=code&scope=${encodeURIComponent(scopes)}&access_type=offline&prompt=consent`;

      let command: string;
      switch (process.platform) {
        case 'darwin': command = `open "${authUrl}"`; break;
        case 'win32': command = `start "" "${authUrl}"`; break;
        default: command = `xdg-open "${authUrl}"`; break;
      }
      
      exec(command, (err) => {
        if (err) {
          console.warn('[GoogleOAuthServer] Could not automatically open browser. URL:', authUrl);
        }
      });
    });

    server.on('error', (err) => {
      reject(new Error(`Failed to bind server on port ${port}: ${err}`));
    });
  });
};
