const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

function charElements(chars: string, x: number, startY: number, fontSize: number, spacing: number): string {
  return chars.split('').map((ch, i) =>
    `<text x="${x}" y="${startY + i * spacing}" fill="#b82020" font-size="${fontSize}" font-family="Noto Sans CJK JP, Noto Sans JP, sans-serif" text-anchor="middle" dominant-baseline="central">${ch}</text>`
  ).join('\n  ');
}

async function main() {
  const size = 600;

  const col1 = charElements('一般社団法人', 510, 70, 50, 56);
  const col2 = charElements('香川イノ', 385, 80, 74, 84);
  const col3 = charElements('ベーショ', 270, 80, 74, 84);
  const col4 = charElements('ンベース', 155, 80, 74, 84);
  const sealChar = `<text x="82" y="505" fill="#b82020" font-size="85" font-family="Noto Sans CJK JP, Noto Sans JP, sans-serif" text-anchor="middle" dominant-baseline="central">印</text>`;

  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect x="15" y="15" width="570" height="570" fill="none" stroke="#b82020" stroke-width="18" rx="10" ry="10"/>
  ${col1}
  ${col2}
  ${col3}
  ${col4}
  ${sealChar}
</svg>`;

  const outPath = path.join(process.cwd(), 'assets', 'seal.png');
  await sharp(Buffer.from(svg)).png().toFile(outPath);
  console.log(`Seal created: ${outPath} (${fs.statSync(outPath).size} bytes)`);
}

main().catch(console.error);
