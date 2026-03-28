/**
 * Gmail API 連携
 * 領収書メール送信専用
 */
import { google } from 'googleapis';
import { createOAuth2Client } from './auth';

/**
 * 領収書メールを送信（PDF添付）
 */
export async function sendReceiptEmail(
  to: string,
  memberName: string,
  receiptPdf: Buffer,
  receiptNumber: string,
): Promise<void> {
  const gmail = google.gmail({ version: 'v1', auth: createOAuth2Client() });

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
      [
        `${memberName} 様`,
        '',
        'この度は会費のお振込みをいただき、誠にありがとうございます。',
        '領収書を添付いたしますので、ご確認ください。',
        '',
        'ご不明な点がございましたら、お気軽にお問い合わせください。',
        '',
      ].join('\n'),
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
    requestBody: { raw: encodedMessage },
  });

  console.log(`領収書メール送信完了: ${to} (${receiptNumber})`);
}
