/**
 * 会費徴収・照合・領収書自動発行システム
 *
 * メインフロー:
 * 1. Google Sheetsから会員台帳を読み込む
 * 2. GmailからSMBC入金通知メールを取得
 * 3. カナ名 + 金額で照合
 * 4. 照合OKなら領収書PDFを生成してメール送信
 * 5. 処理済みとしてSheetsに記録
 */
import { config } from './config';
import { getMembers, getProcessedMessageIds, markAsProcessed } from './sheets';
import { fetchDepositNotifications, sendReceiptEmail } from './gmail';
import { matchDeposits } from './matcher';
import { generateReceiptPdf, generateReceiptNumber } from './receipt';

async function processOnce(): Promise<void> {
  console.log(`[${new Date().toISOString()}] 照合処理を開始...`);

  // 1. 会員台帳を取得
  const members = await getMembers();
  console.log(`  会員台帳: ${members.length}件`);

  if (members.length === 0) {
    console.log('  会員データがありません。スキップします。');
    return;
  }

  // 2. 処理済みメッセージIDを取得
  const processedIds = await getProcessedMessageIds();
  console.log(`  処理済み: ${processedIds.size}件`);

  // 3. SMBC入金通知を取得（直近30日分）
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const afterDate = thirtyDaysAgo.toISOString().slice(0, 10).replace(/-/g, '/');

  const deposits = await fetchDepositNotifications(afterDate);
  console.log(`  入金通知: ${deposits.length}件`);

  if (deposits.length === 0) {
    console.log('  新しい入金通知はありません。');
    return;
  }

  // 4. 照合
  const matches = matchDeposits(members, deposits, processedIds);
  console.log(`  照合結果: ${matches.length}件マッチ`);

  // 5. 照合結果を処理
  for (const match of matches) {
    if (match.confidence === 'high') {
      // 高信頼度：自動で領収書送信
      console.log(`  [OK] ${match.member.name} (${match.member.transferName}) - ¥${match.deposit.amount.toLocaleString()}`);

      const receiptNumber = generateReceiptNumber();
      const receiptPdf = await generateReceiptPdf(match.member, match.deposit, receiptNumber);

      await sendReceiptEmail(
        match.member.email,
        match.member.name,
        receiptPdf,
        receiptNumber,
      );

      await markAsProcessed(
        match.member.email,
        match.deposit.messageId,
        new Date().toISOString(),
      );

      console.log(`  [SENT] 領収書送信完了: ${match.member.email} (${receiptNumber})`);
    } else if (match.confidence === 'medium') {
      // 中信頼度：名前一致だが金額不一致 → 管理者に通知
      console.warn(`  [WARN] 名前一致・金額不一致: ${match.member.name}`);
      console.warn(`    期待金額 vs 入金額: ${match.member.membershipType} vs ¥${match.deposit.amount.toLocaleString()}`);
      console.warn(`    手動確認が必要です。`);
    }
  }

  // マッチしなかった入金通知を報告
  const matchedDepositIds = new Set(matches.map((m) => m.deposit.messageId));
  const unmatchedDeposits = deposits.filter(
    (d) => !processedIds.has(d.messageId) && !matchedDepositIds.has(d.messageId),
  );

  if (unmatchedDeposits.length > 0) {
    console.warn(`\n  [UNMATCHED] 照合できなかった入金: ${unmatchedDeposits.length}件`);
    for (const d of unmatchedDeposits) {
      console.warn(`    ${d.depositorName} - ¥${d.amount.toLocaleString()} (${d.date})`);
    }
  }

  console.log(`[${new Date().toISOString()}] 照合処理完了\n`);
}

async function main(): Promise<void> {
  console.log('=== 会費徴収・照合・領収書自動発行システム ===');
  console.log(`ポーリング間隔: ${config.pollIntervalMinutes}分\n`);

  // 初回実行
  await processOnce();

  // 定期実行
  setInterval(
    () => processOnce().catch(console.error),
    config.pollIntervalMinutes * 60 * 1000,
  );
}

// 単発実行モード（--once オプション）
if (process.argv.includes('--once')) {
  processOnce()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
} else {
  main().catch(console.error);
}
