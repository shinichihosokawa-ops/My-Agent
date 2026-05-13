/**
 * テスト用：1人分の請求書PDFを生成してbase64で出力
 */
import { generateInvoicePdf, generateInvoiceNumber } from './invoice';

async function main() {
  const invoiceNumber = generateInvoiceNumber();
  const now = new Date();
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;

  const pdfBuffer = await generateInvoicePdf({
    invoiceNumber,
    date: dateStr,
    recipientName: '楠木泰二朗',
    membershipType: '正会員',
    admissionFee: 30000,
    annualFee: 120000,
    totalAmount: 150000,
    deadline: '2026年5月22日',
  });

  // base64出力
  const base64 = pdfBuffer.toString('base64');

  // ファイルにも保存（確認用）
  const fs = require('fs');
  const outPath = require('path').join(process.cwd(), 'test-invoice.pdf');
  fs.writeFileSync(outPath, pdfBuffer);
  console.log(`PDF saved: ${outPath}`);
  console.log(`Invoice number: ${invoiceNumber}`);
  console.log(`Size: ${pdfBuffer.length} bytes`);

  // base64をファイルに保存（Gmail MCP用）
  const b64Path = require('path').join(process.cwd(), 'test-invoice-base64.txt');
  fs.writeFileSync(b64Path, base64);
  console.log(`Base64 saved: ${b64Path}`);
}

main().catch(console.error);
