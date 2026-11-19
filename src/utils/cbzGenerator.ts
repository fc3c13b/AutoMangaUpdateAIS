import JSZip from 'jszip';

/**
 * 有効なCBZファイル（ZIPコンテナ）のBlobを生成する
 */
export async function createCbzBlob(
  title: string,
  volume: number,
  sourceInfo?: string
): Promise<Blob> {
  const zip = new JSZip();

  // コミック情報メタデータ (ComicInfo.xml - 漫画リーダー標準フォーマット)
  const comicInfoXml = `<?xml version="1.0" encoding="utf-8"?>
<ComicInfo xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <Title>${escapeXml(title)} 第${volume}巻</Title>
  <Series>${escapeXml(title)}</Series>
  <Number>${volume}</Number>
  <Volume>${volume}</Volume>
  <Summary>AutoMangaUpdate2 自動取得データ (${escapeXml(sourceInfo || 'DL-RAW')})</Summary>
  <Year>${new Date().getFullYear()}</Year>
  <Month>${new Date().getMonth() + 1}</Month>
  <Manga>YesAndRightToLeft</Manga>
</ComicInfo>`;

  zip.file('ComicInfo.xml', comicInfoXml);

  // カバー画像用のSVG/PNGダミー（プレースホルダー）
  const coverSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1800" viewBox="0 0 1200 1800">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e1b4b" />
      <stop offset="50%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#020617" />
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#6366f1" />
      <stop offset="100%" stop-color="#a855f7" />
    </linearGradient>
  </defs>
  <rect width="1200" height="1800" fill="url(#bg)"/>
  <circle cx="600" cy="700" r="320" fill="url(#accent)" opacity="0.15"/>
  <rect x="80" y="80" width="1040" height="1640" fill="none" stroke="url(#accent)" stroke-width="4" rx="20"/>
  <text x="600" y="600" font-family="'Noto Sans JP', sans-serif" font-size="76" font-weight="bold" fill="#ffffff" text-anchor="middle">${escapeXml(title)}</text>
  <text x="600" y="740" font-family="'Noto Sans JP', sans-serif" font-size="96" font-weight="900" fill="#38bdf8" text-anchor="middle">第 ${volume} 巻</text>
  <text x="600" y="860" font-family="'JetBrains Mono', monospace" font-size="32" fill="#94a3b8" text-anchor="middle">AutoMangaUpdate2 // DL-RAW.SI</text>
  <line x1="300" y1="940" x2="900" y2="940" stroke="#334155" stroke-width="2"/>
  <text x="600" y="1020" font-family="'Noto Sans JP', sans-serif" font-size="28" fill="#64748b" text-anchor="middle">取得日: ${new Date().toLocaleDateString('ja-JP')}</text>
  <rect x="450" y="1500" width="300" height="60" rx="30" fill="url(#accent)"/>
  <text x="600" y="1540" font-family="sans-serif" font-size="24" font-weight="bold" fill="#ffffff" text-anchor="middle">NEW RELEASE</text>
</svg>`;

  zip.file('000_cover.svg', coverSvg);
  zip.file('readme.txt', `タイトル: ${title}\n巻数: 第${volume}巻\n取得元: ${sourceInfo || 'DL-RAW.SI'}\n取得日: ${new Date().toISOString()}`);

  return await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.comicbook+zip',
    compression: 'DEFLATE',
  });
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

/**
 * ブラウザ標準ダウンロードをトリガー
 */
export function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
