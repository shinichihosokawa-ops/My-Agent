/**
 * 未入金会員への請求書PDF生成 + Gmail下書き作成スクリプト
 *
 * 使い方:
 *   npx ts-node src/send-invoices.ts          # ドライラン（確認のみ）
 *   npx ts-node src/send-invoices.ts --send    # 実際に下書き作成
 *   npx ts-node src/send-invoices.ts --test 楠木  # 特定の人だけテスト
 */
import { google } from 'googleapis';
import { createOAuth2Client } from './auth';
import { config } from './config';
import { generateInvoicePdf, generateInvoiceNumber, InvoiceData } from './invoice';

interface UnpaidMember {
  rowIndex: number;
  email: string;
  name: string;
  receiptAddress: string;
  membershipType: string;
}

function getFees(membershipType: string) {
  for (const [key, fees] of Object.entries(config.membershipFees)) {
    if (membershipType.includes(key)) return { key, ...fees };
  }
  return null;
}

async function getUnpaidMembers(): Promise<UnpaidMember[]> {
  const auth = createOAuth2Client();
  const sheets = google.sheets({ version: 'v4', auth });

  const formRes = await sheets.spreadsheets.values.get({
    spreadsheetId: config.spreadsheetId,
    range: `'${config.formSheetName}'!A2:K`,
  });

  const paymentRes = await sheets.spreadsheets.values.get({
    spreadsheetId: config.spreadsheetId,
    range: `'${config.managementSheetName}'!L2:M`,
  });

  const rows = formRes.data.values || [];
  const paymentRows = paymentRes.data.values || [];

  const unpaid: UnpaidMember[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const paymentDate = paymentRows[i]?.[0] || '';
    if (paymentDate) continue;

    const email = row[1] || '';
    const name = row[2] || '';
    if (!email || !name) continue;

    unpaid.push({
      rowIndex: i + 2,
      email,
      name,
      receiptAddress: row[4] || name,
      membershipType: row[5] || '',
    });
  }
  return unpaid;
}

function buildEmailBody(name: string, amount: number, breakdown: string): string {
  return `${name} 様

お世話になっております。
一般社団法人香川イノベーションベース（KAIB）事務局でございます。

この度は、KAIBへの会員お申し込みをいただき、誠にありがとうございます。

つきましては、会費のお振込をお願いしたく、請求書を添付にてお送りいたします。

■ お振込先
  三井住友銀行 トランクNORTH支店
  普通預金 0677827
  口座名義: 一般社団法人香川イノベーションベース

■ ご請求金額: ${breakdown}

■ お振込期限: 2026年5月22日（木）

※恐れ入りますが、振込手数料はご負担くださいますようお願い申し上げます。
※お振込の際は、会員登録時のお名前でお振込みください。

ご不明な点がございましたら、お気軽にお問い合わせください。
何卒よろしくお願い申し上げます。

━━━━━━━━━━━━━━━━━━━━━━
一般社団法人 香川イノベーションベース（KAIB）
〒769-2323 香川県さぬき市寒川町神前1615
Email: info@kaib.jp
https://kaib.jp
━━━━━━━━━━━━━━━━━━━━━━`;
}

async function createGmailDraft(
  gmail: ReturnType<typeof google.gmail>,
  to: string,
  subject: string,
  body: string,
  pdfBuffer: Buffer,
  pdfFilename: string,
  fromAlias?: string,
): Promise<string> {
  const boundary = `boundary_${Date.now()}`;

  const headers = [
    `From: ${fromAlias || 'info@kaib.jp'}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ].join('\r\n');

  const textPart = [
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(body).toString('base64'),
  ].join('\r\n');

  const attachmentPart = [
    `--${boundary}`,
    `Content-Type: application/pdf; name="${pdfFilename}"`,
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="${pdfFilename}"`,
    '',
    pdfBuffer.toString('base64'),
  ].join('\r\n');

  const raw = [headers, '', textPart, attachmentPart, `--${boundary}--`].join('\r\n');

  const encodedRaw = Buffer.from(raw)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const res = await gmail.users.drafts.create({
    userId: 'me',
    requestBody: {
      message: { raw: encodedRaw },
    },
  });

  return res.data.id || '';
}

async function main() {
  const args = process.argv.slice(2);
  const sendMode = args.includes('--send');
  const testIdx = args.indexOf('--test');
  const testName = testIdx >= 0 ? args[testIdx + 1] : null;

  console.log('=== KAIB 請求書作成 ===');
  console.log(`モード: ${sendMode ? '下書き作成' : 'ドライラン（確認のみ）'}`);
  if (testName) console.log(`テスト対象: ${testName}`);
  console.log('');

  const unpaid = await getUnpaidMembers();
  console.log(`未入金会員: ${unpaid.length}名\n`);

  let targets = unpaid;
  if (testName) {
    targets = unpaid.filter((m) => m.name.includes(testName));
    if (targets.length === 0) {
      console.log(`「${testName}」に該当する未入金会員が見つかりません。`);
      console.log('未入金会員一覧:');
      unpaid.forEach((m) => console.log(`  Row${m.rowIndex}: ${m.name} (${m.email}) - ${m.membershipType}`));
      return;
    }
  }

  const auth = createOAuth2Client();
  const gmail = google.gmail({ version: 'v1', auth });

  const now = new Date();
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;

  for (const member of targets) {
    const fees = getFees(member.membershipType);
    if (!fees) {
      console.log(`[スキップ] ${member.name}: 会員区分「${member.membershipType}」に対応する料金が不明`);
      continue;
    }

    const invoiceNumber = generateInvoiceNumber();
    const invoiceData: InvoiceData = {
      invoiceNumber,
      date: dateStr,
      recipientName: member.receiptAddress,
      membershipType: fees.key,
      admissionFee: fees.admissionFee,
      annualFee: fees.annualFee,
      totalAmount: fees.total,
      deadline: '2026年5月22日',
    };

    const breakdown = fees.admissionFee > 0
      ? `¥${fees.total.toLocaleString('ja-JP')}（入会金 ¥${fees.admissionFee.toLocaleString('ja-JP')} + 年会費 ¥${fees.annualFee.toLocaleString('ja-JP')}）`
      : `¥${fees.total.toLocaleString('ja-JP')}（年会費）`;

    const subject = `【ご請求】KAIB年会費のお振込のお願い（${invoiceNumber}）`;
    const body = buildEmailBody(member.name, fees.total, breakdown);
    const pdfFilename = `KAIB_請求書_${member.name}_${invoiceNumber}.pdf`;

    console.log(`[${member.name}] Row${member.rowIndex}`);
    console.log(`  Email: ${member.email}`);
    console.log(`  会員区分: ${member.membershipType} → ${fees.key}`);
    console.log(`  金額: ¥${fees.total.toLocaleString('ja-JP')}`);
    console.log(`  請求書番号: ${invoiceNumber}`);

    if (sendMode) {
      const pdfBuffer = await generateInvoicePdf(invoiceData);
      console.log(`  PDF生成: ${pdfBuffer.length} bytes`);

      const draftId = await createGmailDraft(
        gmail, member.email, subject, body, pdfBuffer, pdfFilename, 'info@kaib.jp',
      );
      console.log(`  ✓ Gmail下書き作成完了 (ID: ${draftId})`);
    } else {
      console.log(`  → ドライラン: 下書きは作成しません`);
    }
    console.log('');
  }

  console.log('=== 完了 ===');
  if (!sendMode) {
    console.log('\n実際に下書きを作成するには --send オプションを付けて実行してください:');
    if (testName) {
      console.log(`  npx ts-node src/send-invoices.ts --send --test ${testName}`);
    } else {
      console.log('  npx ts-node src/send-invoices.ts --send');
    }
  }
}

main().catch(console.error);
