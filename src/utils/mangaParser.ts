/**
 * マンガファイル名からタイトルと巻数を高精度に抽出するパーサー
 * 例: "hogehoge 第xx巻.cbz" -> title: "hogehoge", volume: xx
 */
export function parseMangaFilename(fileName: string, fallbackFolderTitle?: string): { title: string; volume: number } {
  // 拡張子を除去 (.cbz, .zip, etc.)
  const nameWithoutExt = fileName.replace(/\.(cbz|zip|rar|cbr|tar)$/i, '').trim();

  // 1. [著者名] や [DL-RAW.SI] などのタグを一時的に整理
  let cleaned = nameWithoutExt;

  // 代表的な巻数パターン抽出
  let volume = 0;
  let titleCandidate = '';

  // パターン 1: "hogehoge 第xx巻" または "hogehoge 第 xx 巻"
  const daiKanMatch = cleaned.match(/^(.*?)[_\s　]*第\s*(\d+(?:\.\d+)?)\s*巻(.*)$/i);
  if (daiKanMatch) {
    titleCandidate = daiKanMatch[1];
    volume = parseFloat(daiKanMatch[2]);
  } else {
    // パターン 2: "hogehoge vol.xx" または "hogehoge vxx" または "hogehoge #xx"
    const volMatch = cleaned.match(/^(.*?)[_\s　]*(?:vol\.?|volume|v)\s*(\d+(?:\.\d+)?)(.*)$/i);
    if (volMatch) {
      titleCandidate = volMatch[1];
      volume = parseFloat(volMatch[2]);
    } else {
      // パターン 3: 末尾に数字 "hogehoge 01" または "hogehoge (01)"
      const trailingNumMatch = cleaned.match(/^(.*?)[_\s　]+(?:[（\(])?(\d+)(?:[）\)])?$/);
      if (trailingNumMatch) {
        titleCandidate = trailingNumMatch[1];
        volume = parseInt(trailingNumMatch[2], 10);
      } else {
        // パターン 4: "第xx巻" のみの場合
        const singleDaiMatch = cleaned.match(/第\s*(\d+)\s*巻/);
        if (singleDaiMatch) {
          volume = parseInt(singleDaiMatch[1], 10);
          titleCandidate = fallbackFolderTitle || cleaned.replace(/第\s*\d+\s*巻/, '');
        }
      }
    }
  }

  // タイトル候補のクリーニング（先頭や末尾の [xxx] や (xxx) の除去）
  let finalTitle = titleCandidate.trim();

  // 先頭の [著者] や [サークル] を除去する場合の調整
  // ただしタイトル自体が [] で囲まれている場合は注意
  if (finalTitle.startsWith('[') && finalTitle.includes(']')) {
    const afterBracket = finalTitle.replace(/^\[[^\]]+\]\s*/, '').trim();
    if (afterBracket.length > 0) {
      finalTitle = afterBracket;
    }
  }

  // 末尾の記号や余計なスペース除去
  finalTitle = finalTitle.replace(/[\-_~　\s]+$/, '').trim();

  // 空文字の場合はフォールバックフォルダ名を使用
  if (!finalTitle && fallbackFolderTitle) {
    finalTitle = fallbackFolderTitle;
  }

  return {
    title: finalTitle || nameWithoutExt,
    volume: isNaN(volume) ? 0 : volume,
  };
}

/**
 * フォルダ名からクリーニングされたタイトルを取得
 */
export function cleanFolderName(folderName: string): string {
  return folderName
    .replace(/^\[[^\]]+\]\s*/, '')
    .replace(/^[_.\s]+/, '')
    .replace(/\s*\[[^\]]+\]$/, '')
    .replace(/\s*\([^\)]+\)$/, '')
    .replace(/\s+\d{1,4}\s*[-〜~–—]\s*\d{1,4}$/, '')
    .trim();
}
