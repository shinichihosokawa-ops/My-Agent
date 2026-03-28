/**
 * Google OAuth2 認証ヘルパー
 * 初回セットアップ時に `npm run auth` で実行し、refresh tokenを取得する
 */
import { google } from 'googleapis';
import http from 'http';
import url from 'url';
import { config } from './config';

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
];

export function createOAuth2Client() {
  const oauth2Client = new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri,
  );

  if (config.google.refreshToken) {
    oauth2Client.setCredentials({
      refresh_token: config.google.refreshToken,
    });
  }

  return oauth2Client;
}

// 直接実行時：ブラウザ認証フローでrefresh tokenを取得
async function main() {
  const oauth2Client = new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri,
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });

  console.log('以下のURLをブラウザで開いて認証してください:');
  console.log(authUrl);

  // コールバックサーバーを起動
  const server = http.createServer(async (req, res) => {
    const queryParams = url.parse(req.url!, true).query;
    const code = queryParams.code as string;

    if (code) {
      const { tokens } = await oauth2Client.getToken(code);
      console.log('\n=== 以下を .env に設定してください ===');
      console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
      console.log('=====================================\n');

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h1>認証成功！このタブを閉じてください。</h1>');
      server.close();
    }
  });

  server.listen(3000, () => {
    console.log('認証コールバックを待機中... (http://localhost:3000)');
  });
}

// ts-node src/auth.ts で直接実行された場合のみ認証フローを起動
if (require.main === module) {
  main().catch(console.error);
}
