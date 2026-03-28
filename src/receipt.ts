/**
 * 領収書PDF生成
 * pdf-libを使用して領収書を生成
 */
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { config } from './config';
import { Member, GmoDepositWebhook } from './types';

/**
 * 領収書番号を生成（日付ベース + 連番）
 */
export function generateReceiptNumber(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const seq = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  return `RCP-${dateStr}-${seq}`;
}

function formatAmount(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`;
}

function getBreakdown(membershipType: string): string {
  for (const [key, fees] of Object.entries(config.membershipFees)) {
    if (membershipType.includes(key)) {
      if (fees.admissionFee === 0) {
        return `${key} 年会費 ${formatAmount(fees.annualFee)}`;
      }
      return `${key} 入会金 ${formatAmount(fees.admissionFee)} + 年会費 ${formatAmount(fees.annualFee)}`;
    }
  }
  return '';
}

/**
 * 領収書PDFを生成
 *
 * NOTE: 日本語表示にはフォントファイルの埋め込みが必要です。
 * fonts/NotoSansJP-Regular.ttf を配置してください。
 */
export async function generateReceiptPdf(
  member: Member,
  deposit: GmoDepositWebhook,
  receiptNumber: string,
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4

  // フォント読み込み
  let font;
  const fontPath = path.join(__dirname, '..', 'fonts', 'NotoSansJP-Regular.ttf');
  if (fs.existsSync(fontPath)) {
    const fontBytes = fs.readFileSync(fontPath);
    font = await pdfDoc.embedFont(fontBytes);
  } else {
    font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    console.warn('警告: 日本語フォントが見つかりません。fonts/NotoSansJP-Regular.ttf を配置してください。');
  }

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const now = new Date();
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
  const amount = parseInt(deposit.depositAmount, 10);

  const margin = 50;
  let y = 780;

  // タイトル
  page.drawText('領 収 書', {
    x: 220, y, size: 28, font: fontBold, color: rgb(0, 0, 0),
  });
  y -= 40;

  // 領収書番号・発行日
  page.drawText(`No. ${receiptNumber}`, { x: margin, y, size: 10, font });
  page.drawText(dateStr, { x: 420, y, size: 10, font });
  y -= 40;

  // 宛名
  page.drawText(member.receiptAddress, { x: margin, y, size: 14, font });
  page.drawText('様', {
    x: margin + font.widthOfTextAtSize(member.receiptAddress, 14) + 5,
    y, size: 14, font,
  });
  y -= 5;
  page.drawLine({
    start: { x: margin, y }, end: { x: 300, y },
    thickness: 1, color: rgb(0, 0, 0),
  });
  y -= 35;

  // 金額
  page.drawText(`金額  ${formatAmount(amount)}`, {
    x: margin, y, size: 22, font: fontBold, color: rgb(0, 0, 0),
  });
  y -= 5;
  page.drawLine({
    start: { x: margin, y }, end: { x: 350, y },
    thickness: 2, color: rgb(0, 0, 0),
  });
  y -= 35;

  // 但し書き
  const breakdown = getBreakdown(member.membershipType);
  page.drawText(`但し  ${breakdown}  として`, {
    x: margin, y, size: 11, font,
  });
  y -= 40;

  // 内訳
  for (const [key, fees] of Object.entries(config.membershipFees)) {
    if (member.membershipType.includes(key)) {
      if (fees.admissionFee > 0) {
        page.drawText(`入会金: ${formatAmount(fees.admissionFee)}`, {
          x: margin + 20, y, size: 10, font,
        });
        y -= 20;
      }
      page.drawText(`年会費: ${formatAmount(fees.annualFee)}`, {
        x: margin + 20, y, size: 10, font,
      });
      y -= 20;
      page.drawText(`合計: ${formatAmount(fees.total)}`, {
        x: margin + 20, y, size: 10, font: fontBold,
      });
      y -= 40;
      break;
    }
  }

  // 発行者情報
  y = 200;
  page.drawText(config.issuer.name, { x: 350, y, size: 12, font });
  y -= 18;
  page.drawText(config.issuer.address, { x: 350, y, size: 9, font });
  y -= 15;
  page.drawText(`TEL: ${config.issuer.tel}`, { x: 350, y, size: 9, font });
  y -= 15;
  if (config.issuer.registrationNumber) {
    page.drawText(`登録番号: ${config.issuer.registrationNumber}`, {
      x: 350, y, size: 9, font,
    });
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
