/**
 * Google Drive連携
 * 指定フォルダのスクリーンショット画像を取得・処理済み移動
 */
import { google, drive_v3 } from 'googleapis';
import { createOAuth2Client } from './auth';
import { config } from './config';

let driveApi: drive_v3.Drive;

function getDrive(): drive_v3.Drive {
  if (!driveApi) {
    driveApi = google.drive({ version: 'v3', auth: createOAuth2Client() });
  }
  return driveApi;
}

const IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
];

export interface DriveImage {
  fileId: string;
  name: string;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif';
  base64: string;
}

/**
 * 指定フォルダ内の画像ファイルを取得
 */
export async function getScreenshots(): Promise<DriveImage[]> {
  const drive = getDrive();

  // フォルダ内の画像ファイルを検索
  const mimeQuery = IMAGE_MIME_TYPES.map((m) => `mimeType='${m}'`).join(' or ');
  const res = await drive.files.list({
    q: `'${config.driveFolderId}' in parents and (${mimeQuery}) and trashed=false`,
    fields: 'files(id,name,mimeType)',
    orderBy: 'createdTime',
  });

  const files = res.data.files || [];
  if (files.length === 0) return [];

  console.log(`Google Driveに${files.length}件のスクショを検出`);

  const images: DriveImage[] = [];
  for (const file of files) {
    const content = await drive.files.get(
      { fileId: file.id!, alt: 'media' },
      { responseType: 'arraybuffer' },
    );

    const base64 = Buffer.from(content.data as ArrayBuffer).toString('base64');
    images.push({
      fileId: file.id!,
      name: file.name!,
      mimeType: file.mimeType as DriveImage['mimeType'],
      base64,
    });
  }

  return images;
}

/**
 * 処理済みフォルダに移動（なければ作成）
 */
export async function moveToProcessed(fileId: string): Promise<void> {
  const drive = getDrive();
  const processedFolderId = await ensureProcessedFolder();

  await drive.files.update({
    fileId,
    addParents: processedFolderId,
    removeParents: config.driveFolderId,
    fields: 'id,parents',
  });
}

/**
 * 「処理済み」サブフォルダを取得or作成
 */
async function ensureProcessedFolder(): Promise<string> {
  const drive = getDrive();

  // 既存の「処理済み」フォルダを探す
  const search = await drive.files.list({
    q: `'${config.driveFolderId}' in parents and name='処理済み' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
  });

  if (search.data.files && search.data.files.length > 0) {
    return search.data.files[0]!.id!;
  }

  // なければ作成
  const folder = await drive.files.create({
    requestBody: {
      name: '処理済み',
      mimeType: 'application/vnd.google-apps.folder',
      parents: [config.driveFolderId],
    },
    fields: 'id',
  });

  return folder.data.id!;
}
