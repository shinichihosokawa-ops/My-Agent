/**
 * Google Sheets API 連携
 * - Form Responses 1: フォーム回答（会員データ）の読み取り
 * - 顧客管理データ: 入金日（L列）・領収書送付完了（M列）の読み書き
 * - 処理済み: 処理済み記録
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
 * 会員データを取得
 * - Form Responses 1 (A〜K列) から会員情報を読み取り
 * - 顧客管理データ (L〜M列) から入金日・領収書送付完了を読み取り
 * - 行番号で結合して返す
 */
export async function getMembers(): Promise<Member[]> {
  const sheets = getSheets();

  // フォーム回答から会員データを取得（A〜K列）
  const formRes = await sheets.spreadsheets.values.get({
    spreadsheetId: config.spreadsheetId,
    range: `'${config.formSheetName}'!A2:K`,
  });

  const rows = formRes.data.values;
  if (!rows || rows.length === 0) {
    return [];
  }

  // 顧客管理データから入金日・領収書送付完了を取得（L〜M列）
  const paymentRes = await sheets.spreadsheets.values.get({
    spreadsheetId: config.spreadsheetId,
    range: `'${config.managementSheetName}'!L2:M`,
  });
  const paymentRows = paymentRes.data.values || [];

  return rows.map((row, index) => ({
    rowIndex: index + 2,  // ヘッダーが1行目なので、データは2行目から
    timestamp: row[0] || '',              // A列: タイムスタンプ
    email: row[1] || '',                  // B列: メールアドレス
    name: row[2] || '',                   // C列: 氏名（漢字）
    transferName: row[3] || '',           // D列: 振込口座名義（カタカナ）
    receiptAddress: row[4] || '',         // E列: 領収書宛名
    membershipType: row[5] || '',         // F列: 会員区分
    expectedDate: row[6] || '',           // G列: 振込予定日
    forumParticipation: row[7] || '',     // H列: フォーラム参加希望
    mentoringParticipation: row[8] || '', // I列: メンタリング参加希望
    companyName: row[9] || '',            // J列: 御社名（学生の場合は学校名）
    facebookUrl: row[10] || '',           // K列: FacebookアカウントURL
    paymentDate: paymentRows[index]?.[0] || '',   // 顧客管理データ L列: 入金日
    receiptSent: paymentRows[index]?.[1] || '',    // 顧客管理データ M列: 領収書送付完了
  }));
}

/**
 * 顧客管理データのL〜M列のヘッダーが未設定なら書き込む（初回実行時のみ）
 */
export async function ensurePaymentHeaders(): Promise<void> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: config.spreadsheetId,
    range: `'${config.managementSheetName}'!L1:M1`,
  });

  const headers = res.data.values?.[0] || [];
  if (headers[0] === '入金日' && headers[1] === '領収書送付完了') return;

  await sheets.spreadsheets.values.update({
    spreadsheetId: config.spreadsheetId,
    range: `'${config.managementSheetName}'!L1:M1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [['入金日', '領収書送付完了']],
    },
  });
}

/**
 * 顧客管理データのL列に入金日を書き込む
 */
export async function markPaymentConfirmed(
  rowIndex: number,
  paymentDate: string,
): Promise<void> {
  const sheets = getSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: config.spreadsheetId,
    range: `'${config.managementSheetName}'!L${rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[paymentDate]],
    },
  });
}

/**
 * 顧客管理データのM列に◯と領収書番号を書き込む（領収書送付完了）
 */
export async function markReceiptSent(
  rowIndex: number,
  receiptNumber: string,
): Promise<void> {
  const sheets = getSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: config.spreadsheetId,
    range: `'${config.managementSheetName}'!M${rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[`◯ (${receiptNumber})`]],
    },
  });
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
