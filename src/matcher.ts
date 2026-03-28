/**
 * 照合エンジン
 * 会員台帳のカナ名 ⇔ GMOあおぞら入金通知のカナ名 + 金額で照合
 */
import { config } from './config';
import { Member, GmoDepositWebhook, MatchResult } from './types';

/**
 * カタカナ正規化：半角→全角統一、スペース除去
 * GMOあおぞらは半角カナ（ﾎｿｶﾜ ｼﾝｲﾁ）で来る
 * Googleフォームは全角カナ（ホソカワ シンイチ）で来る
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
    // 濁点・半濁点の結合（ｶﾞ→ガ等）
    .replace(/([\u30A2-\u30F3])゛/g, (_, base: string) => {
      const code = base.charCodeAt(0);
      return String.fromCharCode(code + 1);
    })
    .replace(/([\u30CF\u30D2\u30D5\u30D8\u30DB])゜/g, (_, base: string) => {
      const code = base.charCodeAt(0);
      return String.fromCharCode(code + 2);
    })
    // スペース・全角スペースを除去
    .replace(/[\s　]/g, '')
    // 小文字カナを大文字カナに（ァ→ア等）
    .replace(/[ァィゥェォッャュョ]/g, (ch) => {
      const map: Record<string, string> = {
        'ァ': 'ア', 'ィ': 'イ', 'ゥ': 'ウ', 'ェ': 'エ', 'ォ': 'オ',
        'ッ': 'ツ', 'ャ': 'ヤ', 'ュ': 'ユ', 'ョ': 'ヨ',
      };
      return map[ch] || ch;
    })
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
 * 入金通知と会員台帳を照合
 */
export function matchDeposit(
  members: Member[],
  deposit: GmoDepositWebhook,
): MatchResult | null {
  const normalizedDepositName = normalizeKana(deposit.remitterNameKana);
  const depositAmount = parseInt(deposit.depositAmount, 10);

  for (const member of members) {
    const normalizedMemberName = normalizeKana(member.transferName);

    const nameMatch = normalizedDepositName === normalizedMemberName;
    const expectedAmount = getExpectedAmount(member.membershipType);
    const amountMatch = expectedAmount !== null && depositAmount === expectedAmount;

    if (nameMatch && amountMatch) {
      return {
        member, deposit,
        confidence: 'high',
        nameMatch: true, amountMatch: true,
      };
    }

    if (nameMatch && !amountMatch) {
      return {
        member, deposit,
        confidence: 'medium',
        nameMatch: true, amountMatch: false,
      };
    }
  }

  return null;
}
