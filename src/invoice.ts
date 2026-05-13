/**
 * 請求書PDF生成
 * pdf-libを使用して請求書を生成
 */
import { PDFDocument, rgb } from 'pdf-lib';
const fontkit = require('fontkit');
import fs from 'fs';
import path from 'path';

export interface InvoiceData {
  invoiceNumber: string;
  date: string;           // 発行日 YYYY年M月D日
  recipientName: string;  // 宛名
  membershipType: string; // 会員区分
  admissionFee: number;   // 入会金
  annualFee: number;      // 年会費
  totalAmount: number;    // 合計金額
  deadline: string;       // 振込期限
}

export function generateInvoiceNumber(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const seq = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  return `INV-${dateStr}-${seq}`;
}

function formatAmount(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`;
}

export async function generateInvoicePdf(data: InvoiceData): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4

  // フォント読み込み
  let font;
  const fontPaths = [
    path.join(__dirname, '..', 'fonts', 'NotoSansJP-Regular.ttf'),
    path.join(process.cwd(), 'fonts', 'NotoSansJP-Regular.ttf'),
  ];
  const fontPath = fontPaths.find((p) => fs.existsSync(p));

  if (fontPath) {
    pdfDoc.registerFontkit(fontkit);
    const fontBytes = fs.readFileSync(fontPath);
    font = await pdfDoc.embedFont(fontBytes, { subset: true });
  } else {
    throw new Error('日本語フォントが見つかりません: fonts/NotoSansJP-Regular.ttf');
  }

  const margin = 50;
  let y = 780;
  const black = rgb(0, 0, 0);
  const gray = rgb(0.5, 0.5, 0.5);

  // タイトル
  page.drawText('請 求 書', {
    x: 220, y, size: 28, font, color: black,
  });
  y -= 40;

  // 請求書番号・発行日
  page.drawText(`No. ${data.invoiceNumber}`, { x: margin, y, size: 10, font });
  page.drawText(`発行日: ${data.date}`, { x: 400, y, size: 10, font });
  y -= 40;

  // 宛名
  page.drawText(data.recipientName, { x: margin, y, size: 14, font });
  page.drawText('様', {
    x: margin + font.widthOfTextAtSize(data.recipientName, 14) + 5,
    y, size: 14, font,
  });
  y -= 5;
  page.drawLine({
    start: { x: margin, y }, end: { x: 300, y },
    thickness: 1, color: black,
  });
  y -= 35;

  // 請求金額
  page.drawText(`ご請求金額  ${formatAmount(data.totalAmount)}`, {
    x: margin, y, size: 22, font, color: black,
  });
  y -= 5;
  page.drawLine({
    start: { x: margin, y }, end: { x: 400, y },
    thickness: 2, color: black,
  });
  y -= 35;

  // 但し書き
  if (data.admissionFee > 0) {
    page.drawText('但し：一般社団法人香川イノベーションベース', { x: margin, y, size: 10, font });
    y -= 18;
    page.drawText('      入会金および年会費として', { x: margin, y, size: 10, font });
  } else {
    page.drawText('但し：一般社団法人香川イノベーションベース', { x: margin, y, size: 10, font });
    y -= 18;
    page.drawText('      年会費として', { x: margin, y, size: 10, font });
  }
  y -= 25;

  // 区切り線
  page.drawLine({
    start: { x: margin, y }, end: { x: 545, y },
    thickness: 0.5, color: gray,
  });
  y -= 25;

  // 内訳
  const period = '2026年4月〜2027年3月';
  page.drawText(`【${data.membershipType}】`, { x: margin, y, size: 10, font });
  y -= 22;
  if (data.admissionFee > 0) {
    page.drawText(`入会金: ${formatAmount(data.admissionFee)}`, {
      x: margin + 20, y, size: 10, font,
    });
    y -= 20;
  }
  page.drawText(`年会費: ${formatAmount(data.annualFee)}（${period}分）`, {
    x: margin + 20, y, size: 10, font,
  });
  y -= 20;
  page.drawText(`合計: ${formatAmount(data.totalAmount)}`, {
    x: margin + 20, y, size: 10, font,
  });
  y -= 40;

  // 区切り線
  page.drawLine({
    start: { x: margin, y }, end: { x: 545, y },
    thickness: 0.5, color: gray,
  });
  y -= 25;

  // 振込期限
  page.drawText(`お振込期限: ${data.deadline}`, {
    x: margin, y, size: 12, font, color: rgb(0.8, 0, 0),
  });
  y -= 30;

  // 振込先情報
  page.drawText('【お振込先】', { x: margin, y, size: 11, font });
  y -= 22;
  page.drawText('三井住友銀行 トランクNORTH支店', { x: margin + 20, y, size: 11, font });
  y -= 20;
  page.drawText('普通預金 0677827', { x: margin + 20, y, size: 11, font });
  y -= 20;
  page.drawText('口座名義: 一般社団法人香川イノベーションベース', { x: margin + 20, y, size: 11, font });
  y -= 20;
  page.drawText('（イッパンシャダンホウジンカガワイノベーションベース）', { x: margin + 20, y, size: 9, font, color: gray });
  y -= 30;

  // 注意事項
  page.drawText('※恐れ入りますが、振込手数料はご負担くださいますようお願い申し上げます。', {
    x: margin, y, size: 9, font, color: gray,
  });

  // 発行者情報（右下）
  y = 180;

  page.drawLine({
    start: { x: 250, y: y + 15 }, end: { x: 545, y: y + 15 },
    thickness: 0.5, color: gray,
  });

  page.drawText('発行元：一般社団法人香川イノベーションベース', { x: 260, y, size: 10, font });
  y -= 16;
  page.drawText('〒769-2323', { x: 260, y, size: 9, font });
  y -= 14;
  page.drawText('香川県さぬき市寒川町神前1615', { x: 260, y, size: 9, font });
  y -= 14;
  page.drawText('Email: info@kaib.jp', { x: 260, y, size: 9, font });

  // 社印画像（発行元テキストの右側に重ねて配置）
  const sealFiles = ['seal.png', 'seal.jpg', 'seal.jpeg'];
  let sealPath: string | undefined;
  for (const file of sealFiles) {
    const candidates = [
      path.join(__dirname, '..', 'assets', file),
      path.join(process.cwd(), 'assets', file),
    ];
    sealPath = candidates.find((p) => fs.existsSync(p));
    if (sealPath) break;
  }
  if (sealPath) {
    try {
      const sharp = require('sharp');
      const resizedBytes = await sharp(sealPath)
        .resize(300, 300)
        .png()
        .toBuffer();
      const sealImage = await pdfDoc.embedPng(resizedBytes);
      const sealSize = 85;
      page.drawImage(sealImage, {
        x: 460, y: 130, width: sealSize, height: sealSize,
      });
    } catch (e) {
      console.error(`社印の埋め込みに失敗: ${e}`);
    }
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
