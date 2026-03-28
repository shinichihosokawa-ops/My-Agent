/**
 * スクリーンショット解析モジュール
 * Claude APIの画像認識で銀行明細スクショから入金データを抽出
 */
import Anthropic from '@anthropic-ai/sdk';
import { config } from './config';
import { DepositEntry } from './types';

const PARSE_PROMPT = `この画像は銀行の入出金明細画面のスクリーンショットです。
表の中から「入金」の行だけを抽出し、以下のJSON配列で返してください。

出力形式（JSON配列のみ、他のテキストは不要）:
[
  {
    "date": "YYYY/MM/DD",
    "depositorName": "依頼人名（カタカナ表記のまま）",
    "amount": 数値（カンマなし）,
    "referenceNumber": "照会番号"
  }
]

注意:
- 「入金」区分の行のみ抽出（「出金」は無視）
- 依頼人名はスクショに表示されているカナ表記をそのまま使用
- 金額はカンマを除いた数値で返す
- 該当する入金がない場合は空配列 [] を返す
- JSON配列のみを返し、説明文は付けないでください`;

let client: Anthropic;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: config.anthropicApiKey });
  }
  return client;
}

/**
 * スクリーンショット画像から入金明細を抽出
 */
export async function parseScreenshot(
  imageBase64: string,
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif' = 'image/png',
): Promise<DepositEntry[]> {
  const anthropic = getClient();

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType,
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: PARSE_PROMPT,
          },
        ],
      },
    ],
  });

  // レスポンスからJSON部分を抽出
  const textContent = response.content.find((c) => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    console.error('Claude APIからテキストレスポンスがありません');
    return [];
  }

  const rawText = textContent.text.trim();

  // JSONブロックを抽出（```json ... ``` で囲まれている場合にも対応）
  let jsonStr = rawText;
  const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1]!.trim();
  }

  try {
    const entries: DepositEntry[] = JSON.parse(jsonStr);
    console.log(`スクショから${entries.length}件の入金を検出`);
    return entries;
  } catch (e) {
    console.error('Claude APIレスポンスのJSONパースに失敗:', rawText);
    return [];
  }
}
