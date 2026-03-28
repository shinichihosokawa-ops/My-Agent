/**
 * GMOあおぞらネット銀行 Webhook署名検証
 */
import crypto from 'crypto';
import { config } from './config';

/**
 * Webhookリクエストの署名を検証
 * GMOあおぞらはHS256でボディを署名し、Base64エンコードした値をヘッダに設定
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string,
): boolean {
  if (!config.gmoAozora.webhookSecret) {
    console.warn('GMO_WEBHOOK_SECRET未設定: 署名検証をスキップします');
    return true;
  }

  const expectedSignature = crypto
    .createHmac('sha256', config.gmoAozora.webhookSecret)
    .update(rawBody)
    .digest('base64');

  return crypto.timingSafeEqual(
    Buffer.from(signatureHeader),
    Buffer.from(expectedSignature),
  );
}
