/**
 * 照合エンジン
 * 会員台帳のカナ名 ⇔ スクショから抽出したカナ名 + 金額で照合
 */
import { config } from './config';
import { Member, DepositEntry, MatchResult } from './types';

/**
 * カタカナ正規化：半角→全角統一、スペース除去
 * 銀行明細は半角カナ（ﾎｿｶﾜ ｼﾝｲﾁ）の場合がある
 * Googleフォームは全角カナ（ホソカワ シンイチ）
 */
function normalizeKana(str: string): string {
  return str
    // 半角カナ→全角カナ
    .replace(/[\uFF65-\uFF9F]/g, (ch) => {
      const halfToFull: Record<string, string> = {
        'ｦ': 'ヲ', 'ｧ': 'ァ', 'ｨ': 'ィ', 'ｩ': 'ゥ', 'ｪ': 'ェ', 'ｫ': 'ォ',
        'ｬ': 'ャ', 'ｭ': 'ュ', 'ｮ': 'ョ', 'ｯ': 'ッ', 'ｰ': 'ー',
        'ｱ': 'ア', 'ｲ': 'イ', 'ｳ': 'ウ', 'ｴ': 'エ', 'ｵ': 'オ',
        'ｶ': 'カ', 'ｷ': 'キ', 'ｸ': 'ク', 'ｹ': 'ケ', 'ｺ': 'コ',
        'ｻ': 'サ', 'ｼ': 'シ', 'ｽ': 'ス', 'ｾ': 'セ', 'ｿ': 'ソ',
        'ﾀ': 'タ', 'ﾁ': 'チ', 'ﾂ': 'ツ', 'ﾃ': 'テ', 'ﾄ': 'ト',
        'ﾅ': 'ナ', 'ﾆ': 'ニ', 'ﾇ': 'ヌ', 'ﾈ': 'ネ', 'ﾉ': 'ノ',
        'ﾊ': 'ハ', 'ﾋ': 'ヒ', 'ﾌ': 'フ', 'ﾍ': 'ヘ', 'ﾎ': 'ホ',
        'ﾏ': 'マ', 'ﾐ': 'ミ', 'ﾑ': 'ム', 'ﾒ': 'メ', 'ﾓ': 'モ',
        'ﾔ': 'ヤ', 'ﾕ': 'ユ', 'ﾖ': 'ヨ',
        'ﾗ': 'ラ', 'ﾘ': 'リ', 'ﾙ': 'ル', 'ﾚ': 'レ', 'ﾛ': 'ロ',
        'ﾜ': 'ワ', 'ﾝ': 'ン', 'ﾞ': '゛', 'ﾟ': '゜',
      };
      return halfToFull[ch] || ch;
    })
    // 濁点・半濁点の結合（カ゛→ガ等）
    .replace(/([\u30A2-\u30F3])゛/g, (_, base: string) => {
      const code = base.charCodeAt(0);
      return String.fromCharCode(code + 1);
    })
    .replace(/([\u30CF\u30D2\u30D5\u30D8\u30DB])゜/g, (_, base: string) => {
      const code = base.charCodeAt(0);
      return String.fromCharCode(code + 2);
    })
    // スペース・全角スペース・括弧等を除去
    .replace(/[\s　\(\)（）]/g, '')
    .trim();
}

/**
 * 会員区分テキストから期待される振込金額を取得
 */
function getExpectedAmount(membershipType: string): number | null {
  for (const [key, fees] of Object.entries(config.membershipFees)) {
    if (membershipType.includes(key)) {
      return fees.total;
    }
  }
  return null;
}

/**
 * 入金明細リストと会員台帳を照合
 */
export function matchDeposits(
  members: Member[],
  deposits: DepositEntry[],
  processedRefs: Set<string>,
): MatchResult[] {
  const results: MatchResult[] = [];

  for (const deposit of deposits) {
    // 既に処理済みの照会番号はスキップ
    if (deposit.referenceNumber && processedRefs.has(deposit.referenceNumber)) continue;

    const normalizedDepositName = normalizeKana(deposit.depositorName);

    for (const member of members) {
      const normalizedMemberName = normalizeKana(member.transferName);

      const nameMatch = normalizedDepositName === normalizedMemberName;
      const expectedAmount = getExpectedAmount(member.membershipType);
      const amountMatch = expectedAmount !== null && deposit.amount === expectedAmount;

      if (nameMatch && amountMatch) {
        results.push({
          member, deposit,
          confidence: 'high',
          nameMatch: true, amountMatch: true,
        });
        break;
      }

      if (nameMatch && !amountMatch) {
        results.push({
          member, deposit,
          confidence: 'medium',
          nameMatch: true, amountMatch: false,
        });
        break;
      }
    }
  }

  return results;
}
