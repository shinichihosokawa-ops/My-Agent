/**
 * 照合エンジン
 * 会員台帳のカナ名 ⇔ SMBC入金通知のカナ名 + 金額で照合
 */
import { config } from './config';
import { Member, DepositNotification, MatchResult } from './types';

/**
 * カタカナ正規化：全角/半角統一、スペース除去
 */
function normalizeKana(str: string): string {
  return str
    // 半角カナ→全角カナ
    .replace(/[\uFF65-\uFF9F]/g, (ch) => {
      const code = ch.charCodeAt(0);
      return String.fromCharCode(code - 0xFEC0);
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
export function matchDeposits(
  members: Member[],
  deposits: DepositNotification[],
  processedMessageIds: Set<string>,
): MatchResult[] {
  const results: MatchResult[] = [];

  for (const deposit of deposits) {
    // 既に処理済みのメッセージはスキップ
    if (processedMessageIds.has(deposit.messageId)) continue;

    const normalizedDepositName = normalizeKana(deposit.depositorName);

    for (const member of members) {
      const normalizedMemberName = normalizeKana(member.transferName);

      // カナ名の照合
      const nameMatch = normalizedDepositName === normalizedMemberName;

      // 金額の照合
      const expectedAmount = getExpectedAmount(member.membershipType);
      const amountMatch = expectedAmount !== null && deposit.amount === expectedAmount;

      if (nameMatch && amountMatch) {
        results.push({
          member,
          deposit,
          confidence: 'high',
          nameMatch: true,
          amountMatch: true,
        });
        break; // 1つの入金に対して1人の会員のみマッチ
      }

      // 名前のみ一致（金額不一致）→ 警告付きで報告
      if (nameMatch && !amountMatch) {
        results.push({
          member,
          deposit,
          confidence: 'medium',
          nameMatch: true,
          amountMatch: false,
        });
        break;
      }
    }
  }

  return results;
}
