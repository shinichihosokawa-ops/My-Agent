/**
 * 会費徴収・照合・領収書自動発行システム
 * Google Cloud Functions エントリーポイント
 *
 * GMOあおぞらネット銀行のWebhookで入金通知を受信し、
 * Google Sheets会員台帳と照合 → 領収書PDF生成 → メール送信
 */
import { HttpFunction } from '@google-cloud/functions-framework';
import { config } from './config';
import { getMembers, getProcessedItemKeys, markAsProcessed } from './sheets';
import { sendReceiptEmail } from './gmail';
import { matchDeposit } from './matcher';
import { generateReceiptPdf, generateReceiptNumber } from './receipt';
import { verifyWebhookSignature } from './webhook';
import { GmoDepositWebhook } from './types';

/**
 * Webhook受信ハンドラ（Cloud Functions エントリーポイント）
 *
 * GMOあおぞらネット銀行から入金発生時にPOSTされる
 */
export const webhookHandler: HttpFunction = async (req, res) => {
  // POSTのみ受け付け
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  try {
    // 署名検証
    const signature = req.headers['x-hmac-signature'] as string || '';
    const rawBody = JSON.stringify(req.body);

    if (config.gmoAozora.webhookSecret && !verifyWebhookSignature(rawBody, signature)) {
      console.error('Webhook署名検証失敗');
      res.status(401).send('Unauthorized');
      return;
    }

    const deposit: GmoDepositWebhook = req.body;
    console.log(`入金通知受信: ${deposit.remitterNameKana} / ¥${deposit.depositAmount} / ${deposit.transactionDate}`);

    // 処理済みチェック（重複防止）
    const processedKeys = await getProcessedItemKeys();
    if (processedKeys.has(deposit.itemKey)) {
      console.log(`既に処理済み: itemKey=${deposit.itemKey}`);
      res.status(200).send('Already processed');
      return;
    }

    // 会員台帳を取得
    const members = await getMembers();
    console.log(`会員台帳: ${members.length}件`);

    // 照合
    const match = matchDeposit(members, deposit);

    if (!match) {
      console.warn(`照合失敗（該当なし）: ${deposit.remitterNameKana} / ¥${deposit.depositAmount}`);
      // TODO: 管理者に通知メール送信
      res.status(200).send('No match found');
      return;
    }

    if (match.confidence === 'high') {
      // 高信頼度：自動で領収書送信
      console.log(`照合OK: ${match.member.name} (${match.member.transferName}) → ¥${deposit.depositAmount}`);

      const receiptNumber = generateReceiptNumber();
      const receiptPdf = await generateReceiptPdf(
        match.member,
        deposit,
        receiptNumber,
      );

      await sendReceiptEmail(
        match.member.email,
        match.member.name,
        receiptPdf,
        receiptNumber,
      );

      await markAsProcessed(
        match.member.email,
        deposit.itemKey,
        new Date().toISOString(),
      );

      console.log(`領収書送信完了: ${match.member.email} (${receiptNumber})`);
      res.status(200).send(`Receipt sent: ${receiptNumber}`);

    } else if (match.confidence === 'medium') {
      // 名前一致だが金額不一致
      console.warn(`名前一致・金額不一致: ${match.member.name}`);
      console.warn(`  期待: ${match.member.membershipType} / 入金: ¥${deposit.depositAmount}`);
      // TODO: 管理者に通知メール送信
      res.status(200).send('Amount mismatch - manual review needed');
    }

  } catch (error) {
    console.error('Webhook処理エラー:', error);
    res.status(500).send('Internal Server Error');
  }
};
