/** Googleフォームからの会員登録データ（Sheetsの1行） */
export interface Member {
  rowIndex: number;            // シート上の行番号（2始まり、ヘッダー除く）
  timestamp: string;           // A列: タイムスタンプ
  email: string;               // B列: メールアドレス
  name: string;                // C列: 氏名（漢字）
  transferName: string;        // D列: 振込口座名義（カタカナ）
  receiptAddress: string;      // E列: 領収書宛名
  membershipType: string;      // F列: 会員区分（選択肢テキスト）
  expectedDate: string;        // G列: 振込予定日
  forumParticipation: string;  // H列: フォーラム参加希望
  mentoringParticipation: string; // I列: メンタリング参加希望
  paymentConfirmed: string;    // J列: 入金確認（◯ = 確認済み）
  paymentDate: string;         // K列: 入金日
}

/** スクリーンショットから抽出した入金明細1件 */
export interface DepositEntry {
  date: string;                // 取引日（YYYY/MM/DD）
  depositorName: string;       // 依頼人名（カタカナ）
  amount: number;              // 入金額
  referenceNumber: string;     // 照会番号
}

/** 照合結果 */
export interface MatchResult {
  member: Member;
  deposit: DepositEntry;
  confidence: 'high' | 'medium' | 'low';
  nameMatch: boolean;
  amountMatch: boolean;
}
