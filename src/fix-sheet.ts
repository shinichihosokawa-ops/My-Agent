/**
 * スプレッドシートの領収書送付完了（M列）を手動修正するスクリプト
 * Gmail送信記録と照合して、未記入のM列を修正する
 */
import { google } from 'googleapis';
import { createOAuth2Client } from './auth';
import { config } from './config';

async function main() {
  const sheets = google.sheets({ version: 'v4', auth: createOAuth2Client() });
  const sheetName = config.managementSheetName;
  const spreadsheetId = config.spreadsheetId;

  console.log('=== スプレッドシート修正開始 ===\n');

  // 修正内容
  const updates = [
    { cell: 'L2', value: '4/8/2026', label: '安部貴士 入金日' },
    { cell: 'M2', value: '◯ (RCP-20260408-898)', label: '安部貴士 領収書送付完了' },
    { cell: 'L3', value: '4/2/2026', label: '大井啓一 入金日' },
    { cell: 'M3', value: '◯ (RCP-20260408-595)', label: '大井啓一 領収書送付完了' },
    { cell: 'M9', value: '◯ (RCP-20260409-506)', label: '永原いさよ 領収書送付完了' },
  ];

  // 削除内容（ズレたデータのクリア）
  const clears = [
    { cell: 'L14', label: '山田健太郎 L列（大井の入金日がズレたもの）' },
    { cell: 'M14', label: '山田健太郎 M列（大井の領収書番号がズレたもの）' },
  ];

  // 記入
  for (const update of updates) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${sheetName}'!${update.cell}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[update.value]] },
    });
    console.log(`[記入] ${update.label}: ${update.value}`);
  }

  // 削除
  for (const clear of clears) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${sheetName}'!${clear.cell}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [['']] },
    });
    console.log(`[削除] ${clear.label}`);
  }

  // 永原のL9を確認して、空なら入金日を記入
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${sheetName}'!L9`,
  });
  const currentL9 = res.data.values?.[0]?.[0] || '';
  if (!currentL9) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${sheetName}'!L9`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [['4/9/2026']] },
    });
    console.log('[記入] 永原いさよ 入金日: 4/9/2026');
  } else {
    console.log(`[確認] 永原いさよ 入金日: ${currentL9}（既存のためスキップ）`);
  }

  console.log('\n=== 修正完了 ===');
}

main().catch(console.error);
