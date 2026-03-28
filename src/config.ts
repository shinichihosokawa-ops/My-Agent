import dotenv from 'dotenv';
dotenv.config();

export const config = {
  // Google API認証
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth2callback',
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN!,
  },

  // Google SheetsのスプレッドシートID
  spreadsheetId: process.env.SPREADSHEET_ID!,

  // シート名
  formSheetName: 'Form Responses 1',
  managementSheetName: '顧客管理データ',

  // Google DriveのフォルダID（スクショ投入先）
  driveFolderId: process.env.DRIVE_FOLDER_ID!,

  // Claude API
  anthropicApiKey: process.env.ANTHROPIC_API_KEY!,

  // 領収書の発行者情報
  issuer: {
    name: process.env.ISSUER_NAME || '',
    address: process.env.ISSUER_ADDRESS || '',
    tel: process.env.ISSUER_TEL || '',
    registrationNumber: process.env.ISSUER_REGISTRATION_NUMBER || '',
  },

  // 会員区分と金額のマッピング（入会金 + 年会費）
  membershipFees: {
    '正会員': { admissionFee: 30000, annualFee: 120000, total: 150000 },
    '準会員': { admissionFee: 10000, annualFee: 60000, total: 70000 },
    '学生会員': { admissionFee: 0, annualFee: 30000, total: 30000 },
  } as Record<string, { admissionFee: number; annualFee: number; total: number }>,
};
