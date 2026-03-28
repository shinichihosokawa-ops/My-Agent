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

/**
 * GMOあおぞらネット銀行 Webhook入金通知ペイロード
 * 振込入金口座の入金明細通知
 */
export interface GmoDepositWebhook {
  vaId: string;                // 振込入金口座ID
  transactionDate: string;     // 取引日（YYYY-MM-DD）
  valueDate: string;           // 起算日（YYYY-MM-DD）
  vaBranchCode: string;        // 支店コード
  vaBranchNameKana: string;    // 支店名カナ
  vaAccountNumber: string;     // 口座番号
  vaAccountNameKana: string;   // 口座名義カナ
  depositAmount: string;       // 入金金額（文字列）
  remitterNameKana: string;    // 振込依頼人名カナ（半角カナ）
  paymentBankName: string;     // 仕向金融機関名カナ
  paymentBranchName: string;   // 仕向支店名カナ
  itemKey: string;             // 明細キー（ユニークID）
  remarks?: string;            // 摘要
}

/** 照合結果 */
export interface MatchResult {
  member: Member;
  deposit: GmoDepositWebhook;
  confidence: 'high' | 'medium' | 'low';
  nameMatch: boolean;
  amountMatch: boolean;
}

/** 処理済み記録（Sheetsに書き戻す） */
export interface ProcessedRecord {
  memberEmail: string;
  depositItemKey: string;
  matchedAt: string;
  receiptSentAt: string;
}
