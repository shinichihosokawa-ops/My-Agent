/**
 * Gmail API 連携
 * SMBC入金通知メールの読み取り・領収書メール送信
 */
import { google, gmail_v1 } from 'googleapis';
import { createOAuth2Client } from './auth';
import { config } from './config';
import { DepositNotification } from './types';

let gmailApi: gmail_v1.Gmail;

function getGmail(): gmail_v1.Gmail {
  if (!gmailApi) {
    gmailApi = google.gmail({ version: 'v1', auth: createOAuth2Client() });
  }
  return gmailApi;
}

/**
 * SMBC入金通知メールを検索して取得
 */
export async function fetchDepositNotifications(afterDate?: string): Promise<DepositNotification[]> {
  const gmail = getGmail();

  // 検索クエリ構築
  let query = `from:${config.smbc.notificationFrom} subject:${config.smbc.notificationSubject}`;
  if (afterDate) {
    query += ` after:${afterDate}`;
  }

  const listRes = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults: 50,
  });

  const messages = listRes.data.messages || [];
  const notifications: DepositNotification[] = [];

  for (const msg of messages) {
    const detail = await gmail.users.messages.get({
      userId: 'me',
      id: msg.id!,
      format: 'full',
    });

    const notification = parseDepositEmail(detail.data);
    if (notification) {
      notifications.push(notification);
    }
  }

  return notifications;
}

/**
 * SMBC入金通知メールの本文をパースして入金情報を抽出
 * ※SMBC TRUNKの実際のメール形式に合わせて調整が必要
 */
function parseDepositEmail(message: gmail_v1.Schema$Message): DepositNotification | null {
  const messageId = message.id || '';
  const headers = message.payload?.headers || [];

  const dateHeader = headers.find((h) => h.name === 'Date');
  const date = dateHeader?.value || '';

  // メール本文を取得
  const body = getEmailBody(message.payload);
  if (!body) return null;

  // 振込人名を抽出（カタカナ）
  // パターン例: 「振込人名：ホソカワ シンイチ」「お振込人名　ホソカワ シンイチ」
  const namePatterns = [
    /振込人名[：:　\s]+([ァ-ヶー\s（）\(\)]+)/,
    /お振込人[：:　\s]+([ァ-ヶー\s（）\(\)]+)/,
    /依頼人名[：:　\s]+([ァ-ヶー\s（）\(\)]+)/,
  ];

  let depositorName = '';
  for (const pattern of namePatterns) {
    const match = body.match(pattern);
    if (match) {
      depositorName = match[1].trim();
      break;
    }
  }

  // 入金額を抽出
  // パターン例: 「入金額：150,000円」「金額　¥150,000」
  const amountPatterns = [
    /入金額[：:　\s]*[¥￥]?([\d,]+)/,
    /金額[：:　\s]*[¥￥]?([\d,]+)/,
    /お振込金額[：:　\s]*[¥￥]?([\d,]+)/,
  ];

  let amount = 0;
  for (const pattern of amountPatterns) {
    const match = body.match(pattern);
    if (match) {
      amount = parseInt(match[1].replace(/,/g, ''), 10);
      break;
    }
  }

  if (!depositorName || !amount) {
    console.warn(`入金通知のパースに失敗: messageId=${messageId}`);
    console.warn(`  depositorName=${depositorName}, amount=${amount}`);
    console.warn(`  body preview: ${body.substring(0, 200)}`);
    return null;
  }

  return { messageId, date, depositorName, amount, rawBody: body };
}

/**
 * メール本文をデコードして取得
 */
function getEmailBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return '';

  // テキストパートを探す
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64url').toString('utf-8');
  }

  // マルチパートの場合は再帰的に探す
  if (payload.parts) {
    for (const part of payload.parts) {
      const body = getEmailBody(part);
      if (body) return body;
    }
  }

  // body.dataが直接ある場合
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64url').toString('utf-8');
  }

  return '';
}

/**
 * 領収書メールを送信
 */
export async function sendReceiptEmail(
  to: string,
  memberName: string,
  receiptPdf: Buffer,
  receiptNumber: string,
): Promise<void> {
  const gmail = getGmail();

  const boundary = 'boundary_' + Date.now();
  const subject = `【領収書】会費のお支払いありがとうございます（${receiptNumber}）`;

  const messageParts = [
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(
      `${memberName} 様\n\nこの度は会費のお振込みをいただき、誠にありがとうございます。\n領収書を添付いたしますので、ご確認ください。\n\nご不明な点がございましたら、お気軽にお問い合わせください。\n`,
    ).toString('base64'),
    '',
    `--${boundary}`,
    'Content-Type: application/pdf',
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="receipt_${receiptNumber}.pdf"`,
    '',
    receiptPdf.toString('base64'),
    '',
    `--${boundary}--`,
  ];

  const rawMessage = messageParts.join('\r\n');
  const encodedMessage = Buffer.from(rawMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedMessage,
    },
  });

  console.log(`領収書メール送信完了: ${to} (${receiptNumber})`);
}
