/**
 * 会費徴収・照合・領収書自動発行システム
 *
 * フロー:
 * A. 手動確認分: J列◯ + K列入金日あり + L列空 → 領収書生成・メール送信
 * B. スクショ分: Google Drive → Claude解析 → 照合 → 領収書生成・メール送信
 */
import { HttpFunction } from '@google-cloud/functions-framework';
import { getScreenshots, moveToProcessed } from './drive';
import { parseScreenshot } from './screenshot-parser';
import { getMembers, getProcessedRefs, markAsProcessed, markPaymentConfirmed, markReceiptSent, ensurePaymentHeaders } from './sheets';
import { matchDeposits } from './matcher';
import { generateReceiptPdf, generateReceiptNumber } from './receipt';
import { sendReceiptEmail } from './gmail';
import { Member, DepositEntry } from './types';
import { config } from './config';

/**
 * 会員区分テキストから金額を取得
 */
function getExpectedAmount(membershipType: string): number | null {
  for (const [key, fees] of Object.entries(config.membershipFees)) {
    if (membershipType.includes(key)) {
      return fees.total;
    }
  }
  return null;
}

async function processOnce(): Promise<string[]> {
  const logs: string[] = [];
  const log = (msg: string) => { console.log(msg); logs.push(msg); };

  log(`[${new Date().toISOString()}] 処理開始...`);

  // 0. ヘッダーを確認（初回のみ書き込み）
  await ensurePaymentHeaders();

  // 1. 全会員データを取得
  const allMembers = await getMembers();
  log(`会員台帳: ${allMembers.length}件`);

  // ========================================
  // A. 手動確認分の領収書送信
  //    L列入金日あり + M列空 → 領収書送信
  // ========================================
  const manualConfirmed = allMembers.filter(
    (m) => m.paymentDate && !m.receiptSent.startsWith('◯'),
  );

  if (manualConfirmed.length > 0) {
    log(`\n--- 手動確認分の領収書送信: ${manualConfirmed.length}件 ---`);

    for (const member of manualConfirmed) {
      const amount = getExpectedAmount(member.membershipType);
      if (!amount) {
        log(`  [SKIP] ${member.name}: 会員区分から金額を特定できません`);
        continue;
      }

      // 入金データを手動確認情報から構築
      const deposit: DepositEntry = {
        date: member.paymentDate,
        depositorName: member.transferName,
        amount,
        referenceNumber: `MANUAL-${member.rowIndex}`,
      };

      const receiptNumber = generateReceiptNumber();
      log(`  [OK] ${member.name} → ¥${amount.toLocaleString()} (入金日: ${member.paymentDate})`);

      const receiptPdf = await generateReceiptPdf(member, deposit, receiptNumber, member.paymentDate);

      await sendReceiptEmail(
        member.email,
        member.name,
        receiptPdf,
        receiptNumber,
      );

      await markReceiptSent(member.rowIndex, receiptNumber);
      log(`  [SENT] 領収書送信: ${member.email} (${receiptNumber})`);
    }
  } else {
    log('手動確認分の未送信はありません。');
  }

  // ========================================
  // B. スクショ方式の処理
  // ========================================
  const screenshots = await getScreenshots();
  if (screenshots.length === 0) {
    log('新しいスクショはありません。');
    log(`\n[${new Date().toISOString()}] 処理完了`);
    return logs;
  }
  log(`\nスクショ: ${screenshots.length}件検出`);

  const processedRefs = await getProcessedRefs();

  // 入金日あり or 領収書送付済みの会員はスクショ処理対象外
  const members = allMembers.filter((m) => !m.paymentDate && !m.receiptSent.startsWith('◯'));
  log(`スクショ照合対象: ${members.length}件 / 処理済み: ${processedRefs.size}件`);

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
        const receiptPdf = await generateReceiptPdf(match.member, match.deposit, receiptNumber, match.deposit.date);

        await sendReceiptEmail(
          match.member.email,
          match.member.name,
          receiptPdf,
          receiptNumber,
        );

        await markPaymentConfirmed(match.member.rowIndex, match.deposit.date);

        await markAsProcessed(
          match.member.email,
          match.deposit.referenceNumber,
          receiptNumber,
        );

        await markReceiptSent(match.member.rowIndex, receiptNumber);

        processedRefs.add(match.deposit.referenceNumber);
        log(`  [SENT] 領収書送信: ${match.member.email} (${receiptNumber})`);

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
