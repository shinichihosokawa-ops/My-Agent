/**
 * テスト用：領収書メール送信テスト
 * 実際の入金なしで領収書PDFを生成してメール送信する
 */
import { generateReceiptPdf, generateReceiptNumber } from './receipt';
import { sendReceiptEmail } from './gmail';
import { Member, DepositEntry } from './types';

async function main() {
  // テスト用の会員データ
  const testMember: Member = {
    rowIndex: 2,
    timestamp: '2026/03/28',
    email: 'shinichi.hosokawa@gmail.com',
    name: '細川 慎一',
    transferName: 'ホソカワ シンイチ',
    receiptAddress: '株式会社HOSOKAWA',
    membershipType: '正会員（入会金：30,000円＋年会費：120,000円＝合計：150,000円）',
    expectedDate: '2026/03/29',
    forumParticipation: '',
    mentoringParticipation: '',
    companyName: '株式会社HOSOKAWA',
    facebookUrl: '',
    paymentDate: '2026/03/28',
    receiptSent: '',
  };

  // テスト用の入金データ
  const testDeposit: DepositEntry = {
    date: '2026/03/28',
    depositorName: 'ホソカワ シンイチ',
    amount: 150000,
    referenceNumber: 'TEST-001',
  };

  console.log('=== 領収書メール送信テスト ===');
  console.log(`宛先: ${testMember.email}`);
  console.log(`名前: ${testMember.name}`);
  console.log(`金額: ¥${testDeposit.amount.toLocaleString()}`);

  const receiptNumber = generateReceiptNumber();
  console.log(`領収書番号: ${receiptNumber}`);

  console.log('領収書PDF生成中...');
  const receiptPdf = await generateReceiptPdf(testMember, testDeposit, receiptNumber);
  console.log(`PDF生成完了 (${receiptPdf.length} bytes)`);

  console.log('メール送信中...');
  await sendReceiptEmail(
    testMember.email,
    testMember.name,
    receiptPdf,
    receiptNumber,
  );

  console.log('=== テスト完了！メールを確認してください ===');
}

main().catch(console.error);
