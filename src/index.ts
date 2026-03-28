/**
 * 会費徴収・照合・領収書自動発行システム
 *
 * フロー:
 * 1. Google Driveの指定フォルダからスクショ画像を取得
 * 2. Claude APIで画像解析 → 入金明細を抽出
 * 3. Sheets会員台帳と照合（カナ名 + 金額）
 * 4. 照合OKなら領収書PDF生成 → メール送信
 * 5. 処理済みとしてSheetsに記録、画像を「処理済み」フォルダに移動
 */
import { HttpFunction } from '@google-cloud/functions-framework';
import { getScreenshots, moveToProcessed } from './drive';
import { parseScreenshot } from './screenshot-parser';
import { getMembers, getProcessedRefs, markAsProcessed, markPaymentConfirmed } from './sheets';
import { matchDeposits } from './matcher';
import { generateReceiptPdf, generateReceiptNumber } from './receipt';
import { sendReceiptEmail } from './gmail';

async function processOnce(): Promise<string[]> {
  const logs: string[] = [];
  const log = (msg: string) => { console.log(msg); logs.push(msg); };

  log(`[${new Date().toISOString()}] 処理開始...`);

  // 1. Google Driveからスクショを取得
  const screenshots = await getScreenshots();
  if (screenshots.length === 0) {
    log('新しいスクショはありません。');
    return logs;
  }
  log(`スクショ: ${screenshots.length}件検出`);

  // 2. 会員台帳と処理済み情報を取得
  const allMembers = await getMembers();
  const processedRefs = await getProcessedRefs();

  // 手作業で入金確認済み（H列に◯）の会員はスクショ処理対象外
  const members = allMembers.filter((m) => m.paymentConfirmed !== '◯');
  const confirmedCount = allMembers.length - members.length;
  log(`会員台帳: ${allMembers.length}件（入金確認済み: ${confirmedCount}件、未確認: ${members.length}件） / 処理済み: ${processedRefs.size}件`);

  // 3. 各スクショを処理
  for (const screenshot of screenshots) {
    log(`\n--- ${screenshot.name} を処理中 ---`);

    // Claude APIで画像解析
    const deposits = await parseScreenshot(screenshot.base64, screenshot.mimeType);
    if (deposits.length === 0) {
      log(`  入金データなし。スキップします。`);
      await moveToProcessed(screenshot.fileId);
      continue;
    }
    log(`  ${deposits.length}件の入金を検出`);

    // 照合
    const matches = matchDeposits(members, deposits, processedRefs);
    log(`  照合結果: ${matches.length}件マッチ`);

    // 照合結果を処理
    for (const match of matches) {
      if (match.confidence === 'high') {
        log(`  [OK] ${match.member.name} (${match.deposit.depositorName}) → ¥${match.deposit.amount.toLocaleString()}`);

        const receiptNumber = generateReceiptNumber();
        const receiptPdf = await generateReceiptPdf(match.member, match.deposit, receiptNumber);

        await sendReceiptEmail(
          match.member.email,
          match.member.name,
          receiptPdf,
          receiptNumber,
        );

        // H列に◯、I列に入金日を書き込む
        await markPaymentConfirmed(match.member.rowIndex, match.deposit.date);

        await markAsProcessed(
          match.member.email,
          match.deposit.referenceNumber,
          receiptNumber,
        );

        processedRefs.add(match.deposit.referenceNumber);
        log(`  [SENT] 領収書送信: ${match.member.email} (${receiptNumber})`);
        log(`  [SHEET] J列◯・K列${match.deposit.date}を記録 (行${match.member.rowIndex})`);

      } else if (match.confidence === 'medium') {
        log(`  [WARN] 名前一致・金額不一致: ${match.member.name}`);
        log(`    期待: ${match.member.membershipType} / 入金: ¥${match.deposit.amount.toLocaleString()}`);
      }
    }

    // マッチしなかった入金を報告
    const matchedRefs = new Set(matches.map((m) => m.deposit.referenceNumber));
    const unmatched = deposits.filter(
      (d) => !processedRefs.has(d.referenceNumber) && !matchedRefs.has(d.referenceNumber),
    );
    if (unmatched.length > 0) {
      log(`  [UNMATCHED] 照合できない入金: ${unmatched.length}件`);
      for (const d of unmatched) {
        log(`    ${d.depositorName} / ¥${d.amount.toLocaleString()} / ${d.date}`);
      }
    }

    // スクショを処理済みフォルダへ移動
    await moveToProcessed(screenshot.fileId);
    log(`  スクショを処理済みフォルダに移動`);
  }

  log(`\n[${new Date().toISOString()}] 処理完了`);
  return logs;
}

/**
 * Cloud Functions HTTPエントリーポイント
 * Cloud Schedulerから定期呼び出し、または手動トリガー
 */
export const processScreenshots: HttpFunction = async (_req, res) => {
  try {
    const logs = await processOnce();
    res.status(200).json({ status: 'ok', logs });
  } catch (error) {
    console.error('処理エラー:', error);
    res.status(500).json({ status: 'error', message: String(error) });
  }
};

// ローカル実行
if (require.main === module || process.argv.includes('--once')) {
  processOnce()
    .then((logs) => {
      console.log(`\n=== 完了（${logs.length}行のログ） ===`);
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
