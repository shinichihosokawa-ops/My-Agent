/**
 * Google Sheets API 連携
 * フォーム回答（会員台帳）の読み取り・処理済みフラグ書き込み
 */
import { google, sheets_v4 } from 'googleapis';
import { createOAuth2Client } from './auth';
import { config } from './config';
import { Member } from './types';

let sheetsApi: sheets_v4.Sheets;

function getSheets(): sheets_v4.Sheets {
  if (!sheetsApi) {
    sheetsApi = google.sheets({ version: 'v4', auth: createOAuth2Client() });
  }
  return sheetsApi;
}

/**
 * フォーム回答シートから全会員データを取得
 */
export async function getMembers(): Promise<Member[]> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: config.spreadsheetId,
    range: 'フォームの回答 1!A2:G',
  });

  const rows = res.data.values;
  if (!rows || rows.length === 0) {
    return [];
  }

  return rows.map((row) => ({
    timestamp: row[0] || '',
    email: row[1] || '',
    name: row[2] || '',
    transferName: row[3] || '',
    receiptAddress: row[4] || '',
    membershipType: row[5] || '',
    expectedDate: row[6] || '',
  }));
}

/**
 * 処理済み記録を「処理済み」シートに書き込む
 */
export async function markAsProcessed(
  memberEmail: string,
  referenceNumber: string,
  receiptNumber: string,
): Promise<void> {
  const sheets = getSheets();
  await ensureProcessedSheet();

  await sheets.spreadsheets.values.append({
    spreadsheetId: config.spreadsheetId,
    range: '処理済み!A:E',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[memberEmail, referenceNumber, receiptNumber, new Date().toISOString(), '送信済み']],
    },
  });
}

/**
 * 処理済み照会番号の一覧を取得（重複防止用）
 */
export async function getProcessedRefs(): Promise<Set<string>> {
  const sheets = getSheets();
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: config.spreadsheetId,
      range: '処理済み!B:B',
    });
    const rows = res.data.values || [];
    return new Set(rows.map((row) => row[0]).filter(Boolean));
  } catch {
    return new Set();
  }
}

/**
 * 「処理済み」シートが存在しない場合に作成
 */
async function ensureProcessedSheet(): Promise<void> {
  const sheets = getSheets();
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: config.spreadsheetId,
  });

  const sheetNames = spreadsheet.data.sheets?.map((s) => s.properties?.title) || [];
  if (sheetNames.includes('処理済み')) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: config.spreadsheetId,
    requestBody: {
      requests: [{
        addSheet: { properties: { title: '処理済み' } },
      }],
    },
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: config.spreadsheetId,
    range: '処理済み!A1:E1',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [['メールアドレス', '照会番号', '領収書番号', '処理日時', 'ステータス']],
    },
  });
}
