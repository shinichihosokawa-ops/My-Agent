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
  companyName: string;         // J列: 御社名（学生の場合は学校名）
  facebookUrl: string;         // K列: FacebookアカウントURL
  paymentDate: string;         // 顧客管理データ L列: 入金日（入力あり＝入金済み）
  receiptSent: string;         // 顧客管理データ M列: 領収書送付完了（◯ = 送付済み）
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
