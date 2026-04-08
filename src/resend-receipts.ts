/**
 * 領収書差し替え再送スクリプト
 * M列に「◯」がある会員に対して、修正済みの領収書を再送する
 */
import { getMembers } from './sheets';
import { generateReceiptPdf, generateReceiptNumber } from './receipt';
import { Member, DepositEntry } from './types';
import { config } from './config';
import { google } from 'googleapis';
import { createOAuth2Client } from './auth';

function getExpectedAmount(membershipType: string): number | null {
  for (const [key, fees] of Object.entries(config.membershipFees)) {
    if (membershipType.includes(key)) {
      return fees.total;
    }
  }
  return null;
}

async function sendCorrectionEmail(
  to: string,
  memberName: string,
  receiptPdf: Buffer,
  receiptNumber: string,
): Promise<void> {
  const gmail = google.gmail({ version: 'v1', auth: createOAuth2Client() });

  const boundary = 'boundary_' + Date.now();
  const subject = `【領収書・差替】KAIB年会費の領収書を再送いたします（${receiptNumber}）`;

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
        'いつもお世話になっております。',
        '',
        '先日お送りした領収書に記載の年会費対象期間に誤りがございました。',
        '修正した領収書を添付いたしますので、お差し替えをお願いいたします。',
        '',
        '大変申し訳ございませんが、前回の領収書は破棄いただけますと幸いです。',
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

  console.log(`差替メール送信完了: ${to} (${receiptNumber})`);
}

async function main() {
  console.log('=== 領収書差替再送 ===\n');

  const allMembers = await getMembers();

  // M列に「◯」がある（＝既に領収書送信済み）会員を抽出
  const sentMembers = allMembers.filter((m) => m.receiptSent.startsWith('◯'));

  if (sentMembers.length === 0) {
    console.log('再送対象の会員はいません。');
    return;
  }

  console.log(`再送対象: ${sentMembers.length}名\n`);

  for (const member of sentMembers) {
    const amount = getExpectedAmount(member.membershipType);
    if (!amount) {
      console.log(`[SKIP] ${member.name}: 金額を特定できません`);
      continue;
    }

    const deposit: DepositEntry = {
      date: member.paymentDate,
      depositorName: member.transferName,
      amount,
      referenceNumber: `RESEND-${member.rowIndex}`,
    };

    const receiptNumber = generateReceiptNumber();
    console.log(`${member.name} (${member.email})`);
    console.log(`  入金日: ${member.paymentDate}`);
    console.log(`  金額: ¥${amount.toLocaleString()}`);
    console.log(`  新領収書番号: ${receiptNumber}`);

    const receiptPdf = await generateReceiptPdf(member, deposit, receiptNumber, member.paymentDate);
    await sendCorrectionEmail(member.email, member.name, receiptPdf, receiptNumber);
    console.log(`  [SENT] 差替メール送信完了\n`);
  }

  console.log('=== 差替再送完了 ===');
}

main().catch(console.error);
