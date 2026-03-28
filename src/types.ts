/** Googleフォームからの会員登録データ（Sheetsの1行） */
export interface Member {
  timestamp: string;
  email: string;
  name: string;              // 氏名（漢字）
  transferName: string;      // 振込口座名義（カタカナ）
  receiptAddress: string;    // 領収書宛名
  membershipType: string;    // 会員区分（選択肢テキスト）
  expectedDate: string;      // 振込予定日
}

/** SMBC入金通知メールから抽出した情報 */
export interface DepositNotification {
  messageId: string;
  date: string;
  depositorName: string;     // 振込人名（カタカナ）
  amount: number;            // 入金額
  rawBody: string;
}

/** 照合結果 */
export interface MatchResult {
  member: Member;
  deposit: DepositNotification;
  confidence: 'high' | 'medium' | 'low';
  nameMatch: boolean;
  amountMatch: boolean;
}

/** 処理済み記録（Sheetsに書き戻す） */
export interface ProcessedRecord {
  memberEmail: string;
  depositMessageId: string;
  matchedAt: string;
  receiptSentAt: string;
}
