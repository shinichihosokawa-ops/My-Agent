/**
 * スプレッドシートの入金日・領収書送付完了を全件復元するスクリプト
 * Gmail送信記録から確認済みのデータを一括書き込み
 */
import { google } from 'googleapis';
import { createOAuth2Client } from './auth';
import { config } from './config';

async function main() {
  const sheets = google.sheets({ version: 'v4', auth: createOAuth2Client() });
  const sheetName = config.managementSheetName;
  const spreadsheetId = config.spreadsheetId;

  console.log('=== 全データ復元開始 ===\n');

  // Gmail送信記録から確認済みの全データ
  const restorations = [
    // Row 2: 安部貴士 (abe@kotatsu.tv)
    // 最新: 差替 RCP-20260408-898 (4/8送信)
    { cell: 'L2', value: '4/8/2026', label: '安部貴士 入金日' },
    { cell: 'M2', value: '◯ (RCP-20260408-898)', label: '安部貴士 領収書送付完了' },

    // Row 3: 大井啓一 (oi@tsutsuku.com)
    // 最新: 差替 RCP-20260408-595 (4/8送信、初回4/2入金)
    { cell: 'L3', value: '4/2/2026', label: '大井啓一 入金日' },
    { cell: 'M3', value: '◯ (RCP-20260408-595)', label: '大井啓一 領収書送付完了' },

    // Row 8: 管東佑衣子 (enmusubibartendrly@gmail.com)
    // RCP-20260409-813 (4/9送信)
    { cell: 'L8', value: '4/9/2026', label: '管東佑衣子 入金日' },
    { cell: 'M8', value: '◯ (RCP-20260409-813)', label: '管東佑衣子 領収書送付完了' },

    // Row 9: 永原いさよ (ginsta100@gmail.com)
    // RCP-20260409-506 (4/9送信)
    { cell: 'L9', value: '4/9/2026', label: '永原いさよ 入金日' },
    { cell: 'M9', value: '◯ (RCP-20260409-506)', label: '永原いさよ 領収書送付完了' },

    // Row 12: 川西健雄 (kawa24takeo@gmail.com)
    // RCP-20260430-171 (4/30送信)
    { cell: 'L12', value: '4/30/2026', label: '川西健雄 入金日' },
    { cell: 'M12', value: '◯ (RCP-20260430-171)', label: '川西健雄 領収書送付完了' },

    // Row 13: 井上哲貴 (tetsuki.inoue@helphr.co.jp)
    // RCP-20260410-611 (4/10送信)
    { cell: 'L13', value: '4/9/2026', label: '井上哲貴 入金日' },
    { cell: 'M13', value: '◯ (RCP-20260410-611)', label: '井上哲貴 領収書送付完了' },
  ];

  // ズレたデータをクリア（他の人の値が間違った行に入っていた分）
  const clears = [
    { cell: 'L14', label: '山田健太郎 L列（大井のズレ）' },
    { cell: 'M14', label: '山田健太郎 M列（大井のズレ）' },
    { cell: 'M18', label: '玉井謙二 M列（安部のズレ）' },
  ];

  // 復元書き込み
  for (const item of restorations) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${sheetName}'!${item.cell}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[item.value]] },
    });
    console.log(`[復元] ${item.label}: ${item.value}`);
  }

  // ズレたデータのクリア
  for (const item of clears) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${sheetName}'!${item.cell}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [['']] },
    });
    console.log(`[クリア] ${item.label}`);
  }

  // ヘッダー確認
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${sheetName}'!L1:M1`,
  });
  const headers = headerRes.data.values?.[0] || [];
  if (headers[0] !== '入金日' || headers[1] !== '領収書送付完了') {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${sheetName}'!L1:M1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [['入金日', '領収書送付完了']] },
    });
    console.log('[復元] ヘッダー: 入金日, 領収書送付完了');
  }

  console.log('\n=== 復元完了 ===');
  console.log('\n復元内容:');
  console.log('  安部貴士:   入金4/8  → RCP-20260408-898');
  console.log('  大井啓一:   入金4/2  → RCP-20260408-595');
  console.log('  管東佑衣子: 入金4/9  → RCP-20260409-813');
  console.log('  永原いさよ: 入金4/9  → RCP-20260409-506');
  console.log('  川西健雄:   入金4/30 → RCP-20260430-171');
  console.log('  井上哲貴:   入金4/9  → RCP-20260410-611');
}

main().catch(console.error);
