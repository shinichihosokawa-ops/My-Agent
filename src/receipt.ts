/**
 * 領収書PDF生成
 * pdf-libを使用して領収書を生成
 */
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fontkit = require('fontkit');
import fs from 'fs';
import path from 'path';
import { config } from './config';
import { Member, DepositEntry } from './types';

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

/**
 * 年会費の対象期間を算出（入金月の翌月から1年間）
 */
function getAnnualFeePeriod(): string {
  const now = new Date();
  const startYear = now.getFullYear();
  const startMonth = now.getMonth() + 2; // 翌月
  const start = startMonth > 12
    ? `${startYear + 1}年1月`
    : `${startYear}年${startMonth}月`;
  const endMonth = startMonth > 12 ? 1 : startMonth;
  const endYear = startMonth > 12 ? startYear + 2 : startYear + 1;
  const end = `${endYear}年${endMonth}月`;
  return `${start}〜${end}`;
}

/**
 * 但し書きテキストを生成
 */
function getProviso(membershipType: string): string[] {
  for (const [_key, fees] of Object.entries(config.membershipFees)) {
    if (membershipType.includes(_key)) {
      if (fees.admissionFee > 0) {
        return [
          '但し：一般社団法人香川イノベーションベース（設立準備中）',
          '      入会金および年会費の代理受領分として',
        ];
      }
      return [
        '但し：一般社団法人香川イノベーションベース（設立準備中）',
        '      年会費の代理受領分として',
      ];
    }
  }
  return [];
}

/**
 * 領収書PDFを生成
 *
 * NOTE: 日本語表示にはフォントファイルの埋め込みが必要です。
 * fonts/NotoSansJP-Regular.ttf を配置してください。
 */
export async function generateReceiptPdf(
  member: Member,
  deposit: DepositEntry,
  receiptNumber: string,
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]); // A4

  // フォント読み込み
  let font;
  // ts-nodeでは__dirnameがsrc/、ビルド後はdist/を指すのでどちらでも探す
  const fontPaths = [
    path.join(__dirname, '..', 'fonts', 'NotoSansJP-Regular.ttf'),
    path.join(process.cwd(), 'fonts', 'NotoSansJP-Regular.ttf'),
  ];
  const fontPath = fontPaths.find((p) => fs.existsSync(p));

  if (fontPath) {
    console.log(`フォント読み込み: ${fontPath}`);
    console.log(`fontkit type: ${typeof fontkit}, keys: ${Object.keys(fontkit || {}).join(', ')}`);
    pdfDoc.registerFontkit(fontkit);
    const fontBytes = fs.readFileSync(fontPath);
    font = await pdfDoc.embedFont(fontBytes);
  } else {
    console.warn(`警告: 日本語フォントが見つかりません。探したパス:`);
    fontPaths.forEach((p) => console.warn(`  ${p}`));
    font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  }

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const now = new Date();
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
  const amount = deposit.amount;

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
  const provisoLines = getProviso(member.membershipType);
  for (const line of provisoLines) {
    page.drawText(line, { x: margin, y, size: 10, font });
    y -= 18;
  }
  y -= 15;

  // 区切り線
  page.drawLine({
    start: { x: margin, y }, end: { x: 545, y },
    thickness: 0.5, color: rgb(0.5, 0.5, 0.5),
  });
  y -= 25;

  // 内訳
  const period = getAnnualFeePeriod();
  for (const [key, fees] of Object.entries(config.membershipFees)) {
    if (member.membershipType.includes(key)) {
      page.drawText(`【${key}】`, { x: margin, y, size: 10, font: fontBold });
      y -= 22;
      if (fees.admissionFee > 0) {
        page.drawText(`入会金: ${formatAmount(fees.admissionFee)}`, {
          x: margin + 20, y, size: 10, font,
        });
        y -= 20;
      }
      page.drawText(`年会費: ${formatAmount(fees.annualFee)}（${period}分）`, {
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
  y = 180;

  // 区切り線
  page.drawLine({
    start: { x: 300, y: y + 15 }, end: { x: 545, y: y + 15 },
    thickness: 0.5, color: rgb(0.5, 0.5, 0.5),
  });

  page.drawText('発行元：株式会社HOSOKAWA', { x: 310, y, size: 10, font: fontBold });
  y -= 16;
  page.drawText('一般社団法人香川イノベーションベース', { x: 330, y, size: 9, font });
  y -= 14;
  page.drawText('設立準備事務局 代理', { x: 330, y, size: 9, font });
  y -= 18;
  page.drawText(`住所：${config.issuer.address}`, { x: 310, y, size: 9, font });
  y -= 14;
  if (config.issuer.tel) {
    page.drawText(`TEL：${config.issuer.tel}`, { x: 310, y, size: 9, font });
    y -= 14;
  }
  if (config.issuer.registrationNumber) {
    page.drawText(`登録番号：${config.issuer.registrationNumber}`, { x: 310, y, size: 9, font });
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
