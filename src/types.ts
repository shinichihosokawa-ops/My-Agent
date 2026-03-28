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

/** スクリーンショットから抽出した入金明細1件 */
export interface DepositEntry {
  date: string;              // 取引日（YYYY/MM/DD）
  depositorName: string;     // 依頼人名（カタカナ）
  amount: number;            // 入金額
  referenceNumber: string;   // 照会番号
}

/** 照合結果 */
export interface MatchResult {
  member: Member;
  deposit: DepositEntry;
  confidence: 'high' | 'medium' | 'low';
  nameMatch: boolean;
  amountMatch: boolean;
}
