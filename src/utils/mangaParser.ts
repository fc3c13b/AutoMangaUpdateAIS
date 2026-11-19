/**
 * マンガファイル名からタイトルと巻数を高精度に抽出するパーサー
 * 例: "hogehoge 第xx巻.cbz" -> title: "hogehoge", volume: xx
 */
export function parseMangaFilename(fileName: string, fallbackFolderTitle?: string): { title: string; volume: number } {
  // 拡張子を除去 (.cbz, .zip, etc.) ＆ 全角数字・記号を半角正規化 (第０１巻 -> 第01巻)
  const nameWithoutExt = fileName.replace(/\.(cbz|zip|rar|cbr|tar)$/i, '').trim();
  const cleaned = nameWithoutExt.normalize('NFKC');

  // 代表的な巻数パターン抽出
  let volume = 0;
  let titleCandidate = '';

  // パターン 1: "hogehoge 第xx巻" または "hogehoge 第 xx 巻"
  const daiKanMatch = cleaned.match(/^(.*?)[_\s]*第\s*(\d+(?:\.\d+)?)\s*巻(.*)$/i);
  if (daiKanMatch) {
    titleCandidate = daiKanMatch[1];
    volume = parseFloat(daiKanMatch[2]);
  } else {
    // パターン 2: "hogehoge vol.xx" または "hogehoge vxx"
    const volMatch = cleaned.match(/^(.*?)[_\s]*(?:vol\.?|volume|v)\s*(\d+(?:\.\d+)?)(.*)$/i);
    if (volMatch) {
      titleCandidate = volMatch[1];
      volume = parseFloat(volMatch[2]);
    } else {
      // パターン 3: 末尾に数字/巻 "hogehoge 01巻", "hogehoge 第01", "hogehoge 01", "hogehoge 01 [tag]"
      const trailingNumMatch = cleaned.match(
        /^(.*?)[_\s]+(?:第\s*)?(?:[（(])?(\d+(?:\.\d+)?)(?:\s*巻)?(?:[）)])?(?:[\s_]*(?:\[[^\]]+\]|\([^\d)]*[^\d\s)][^\)]*\)))*$/
      );
      if (trailingNumMatch) {
        titleCandidate = trailingNumMatch[1];
        volume = parseFloat(trailingNumMatch[2]);
      } else {
        // パターン 4: "第xx巻" または "xx巻"
        const singleDaiMatch = cleaned.match(/(?:第\s*)?(\d+(?:\.\d+)?)\s*巻/);
        if (singleDaiMatch) {
          volume = parseFloat(singleDaiMatch[1]);
          titleCandidate = (fallbackFolderTitle ? cleanFolderName(fallbackFolderTitle) : '') || cleaned.replace(/(?:第\s*)?\d+(?:\.\d+)?\s*巻/, '');
        } else {
          // パターン 5: ファイル名が数字のみ ("01.cbz", "第01.cbz", "(01).rar")
          const bareNumMatch = cleaned.match(/^(?:第\s*)?(?:[（(\[])?(\d+(?:\.\d+)?)(?:[）)\]])?$/);
          if (bareNumMatch) {
            volume = parseFloat(bareNumMatch[1]);
            titleCandidate = fallbackFolderTitle ? cleanFolderName(fallbackFolderTitle) : '';
          }
        }
      }
    }
  }

  // タイトル候補のクリーニング（先頭や末尾の [xxx] の除去）
  let finalTitle = titleCandidate.trim();

  // 先頭の [著者] や [サークル] を除去する場合の調整
  if (finalTitle.startsWith('[') && finalTitle.includes(']')) {
    const afterBracket = finalTitle.replace(/^\[[^\]]+\]\s*/, '').trim();
    if (afterBracket.length > 0) {
      finalTitle = afterBracket;
    }
  }

  // 末尾の記号や余計なスペース除去
  finalTitle = finalTitle.replace(/[\-_~　\s]+$/, '').trim();

  // 空文字の場合はフォールバックフォルダ名を整形して使用
  if (!finalTitle && fallbackFolderTitle) {
    finalTitle = cleanFolderName(fallbackFolderTitle) || fallbackFolderTitle.trim();
  }

  return {
    title: finalTitle || cleaned,
    volume: isNaN(volume) ? 0 : volume,
  };
}

/**
 * フォルダ名からクリーニングされたタイトルを取得
 * - 先頭に3文字以内のひらがな・カタカナ＋スペース区切りがある場合は削除（例: "あ タイトル" -> "タイトル"）
 * - 末尾に "1-12" のようなハイフンまたぎ数字がある場合は削除
 * - 前後のスペースを除去
 */
export function cleanFolderName(folderName: string): string {
  let cleaned = (folderName || '').replace(/^[\s　]+|[\s　]+$/g, '');

  // 先頭の [著者] や [タグ] があれば除去
  cleaned = cleaned.replace(/^\[[^\]]+\][\s　]*/, '').replace(/^[\s　]+|[\s　]+$/g, '');

  // 先頭に3文字以内のひらがなかカタカナ + スペース区切りがある場合は削除
  cleaned = cleaned.replace(/^[\u3041-\u309F\u30A1-\u30FF]{1,3}[\s　]+/, '');

  // 先頭ノイズや末尾の [タグ]・(タグ) を除去
  cleaned = cleaned
    .replace(/^[_.\s　]+/, '')
    .replace(/[\s　]*\[[^\]]+\][\s　]*$/, '')
    .replace(/[\s　]*\([^\)]+\)[\s　]*$/, '');

  // 末尾の "1-12" のようなハイフンまたぎ数字を削除
  cleaned = cleaned.replace(
    /(?:[\s　]+|(?:第|vol\.?|volume|v)[\s　]*|[（(])?\d{1,4}(?:\.\d+)?[\s　]*[-－〜~–—－][\s　]*\d{1,4}(?:\.\d+)?[\s　]*(?:巻|[）)])?[\s　]*$/i,
    ''
  );

  // 前後のスペース（半角・全角）を確実に除去
  return cleaned.replace(/^[\s　]+|[\s　]+$/g, '');
}

/**
 * dl-raw.si の記事タイトルからダウンロードファイル名用のクリーンタイトルを抽出する
 * - "難攻不落の魔王城へようこそ～...～ raw 第01-12巻" -> "難攻不落の魔王城へようこそ～...～"
 * - "2度目の人生...～@COMIC raw 第01-03巻" -> "2度目の人生...～"
 * - "異世界パパ活おじさん（コミック） raw 第01-09巻" -> "異世界パパ活おじさん"
 */
export function extractDlRawDisplayTitle(articleTitle: string, fallbackTitle?: string): string {
  let s = (articleTitle || '').trim();
  if (!s) return (fallbackTitle || '').trim();

  // 先頭のカテゴリタグ ([一般コミック], [Manga] 等) を除去
  s = s.replace(
    /^\[(?:一般コミック|成年コミック|コミック|Manga|RAW|DL-RAW|雑誌|同人誌|その他)\][\s　]*/i,
    ''
  ).trim();

  // 末尾のノイズ（巻数・raw・@COMIC・（コミック）等の版/媒体表記）を後ろから反復除去
  for (let i = 0; i < 10; i++) {
    const prev = s;

    // 末尾の英字副題ブラケット [English Title ...] (末尾が空白+[]の時)
    s = s.replace(/[\s　]+\[[A-Za-z0-9\s\-_.'",:;!?&()\/~〜]+\][\s　]*$/i, '');

    // 末尾の巻数表現 (第01-12巻, 第13巻, Vol.01-05, v04s, 第3話, 上下巻, 全N巻 等)
    s = s.replace(
      /(?:[\s　]+|^)(?:第[\s　]*[0-9０-９]+(?:\.[0-9０-９]+)?[\s　]*[-〜~–—－][\s　]*(?:第[\s　]*)?[0-9０-９]+(?:\.[0-9０-９]+)?(?:[\s　]*[\+,、][\s　]*[0-9０-９]+(?:\.[0-9０-９]+)?)*[\s　]*巻|[0-9０-９]+(?:\.[0-9０-９]+)?[\s　]*[-〜~–—－][\s　]*[0-9０-９]+(?:\.[0-9０-９]+)?[\s　]*巻|第[\s　]*[0-9０-９]+(?:\.[0-9０-９]+)?[\s　]*巻|[0-9０-９]+(?:\.[0-9０-９]+)?[\s　]*巻|(?:vol(?:ume)?\.?|v|Ｖｏｌ(?:ｕｍｅ)?\.?|ｖ)[\s　]*[0-9０-９]+(?:\.[0-9０-９]+)?(?:[\s　]*[-〜~–—－][\s　]*(?:vol(?:ume)?\.?|v|Ｖｏｌ\.?|ｖ)?[\s　]*[0-9０-９]+(?:\.[0-9０-９]+)?)?s?|第[\s　]*[0-9０-９]+[\s　]*話|上[・\s　]?中[・\s　]?下巻|上[・\s　]?下巻|上巻|中巻|下巻|全[0-9０-９一二三四五六七八九十]+巻)[\s　]*$/i,
      ''
    );

    // 末尾の raw / raws / manga / zip / rar / cbz / dl-raw
    s = s.replace(/(?:[\s　]+|^)(?:raws?|manga|zip|rar|cbz|cbr|dl-raw)[\s　]*$/i, '');

    // 末尾の @COMIC / ＠COMIC / @コミック / ＠コミック 等
    s = s.replace(/[\s　]*[@＠][\s　]*(?:COMIC|コミック|comics?)[\s　]*$/i, '');

    // 末尾の媒体・版表記の括弧書き: （コミック）, (電子版), [分冊版], 【特装版】 等
    s = s.replace(
      /[\s　]*[\(（\[【［][\s　]*(?:コミック|コミック版|コミックス|コミカライズ|マンガ|電子書籍?|電子版|デジタル版?|デジタルコミック|分冊版|合本版|合冊版|単行本版?|完全版|新装版|新装再編版|愛蔵版|特装版|限定版|フル?カラー版?|モノクロ版|Web版|ウェブ版|雑誌連載版|連載版|R18|完|完結|RAW|DL-RAW)[^\)）\]】］]{0,12}[\)）\]】］][\s　]*$/i,
      ''
    );

    // 末尾の括弧なし版・媒体表記 (半角/全角スペース区切り)
    s = s.replace(
      /[\s　]+(?:カラー版|モノクロ版|デジタル版|フルカラー版|完全版|新装版|新装再編版|愛蔵版|特装版|限定版|分冊版|合本版|合冊版|電子版|コミック版|コミック|単行本版|完結|完)[\s　]*$/i,
      ''
    );

    s = s.trim();
    if (s === prev) break;
  }

  // 末尾に不要な記号・スペースが残った場合のみ整理（タイトル固有の ～ や 。 は残す）
  s = s.replace(/[\s　\-_・:：]+$/, '').trim();
  return s || (fallbackTitle || '').trim();
}

function padVolumeNumberStr(numStr: string): string {
  const clean = numStr.replace(/[０-９．]/g, (ch) => ch.normalize('NFKC'));
  const [intPart, decPart] = clean.split('.');
  const parsedInt = parseInt(intPart, 10);
  if (isNaN(parsedInt)) return clean;
  const paddedInt = String(parsedInt).padStart(2, '0');
  return decPart !== undefined && decPart !== '' ? `${paddedInt}.${decPart}` : paddedInt;
}

/**
 * ダウンロードしたファイル名を「{dl-raw.si記事タイトル} 第XX巻.{元の拡張子}」へ統一整形する
 * - 巻数 XX は 1 なら 01（2桁以上ゼロ埋め）
 * - preferredTitle が無い場合のみ、元ファイル名中の Vol.X / v04s / 第X巻 等を第XX巻へ変換
 */
export function formatDownloadedFilename(
  rawFileName: string,
  preferredTitle: string,
  fallbackVolume: number,
  fallbackExt: string = 'rar'
): string {
  const trimmed = (rawFileName || '').trim();
  const extMatch = trimmed.match(/\.([a-z0-9]{2,5})$/i);
  const ext = extMatch
    ? extMatch[1].toLowerCase()
    : (fallbackExt || 'rar').replace(/^\./, '').toLowerCase();
  const baseName = extMatch ? trimmed.slice(0, -extMatch[0].length).trim() : trimmed;

  const cleanPreferredTitle = (preferredTitle || '')
    .trim()
    .replace(/[\/\\?%*:|"<>]/g, '_')
    .replace(/[\u0000-\u001f]/g, '')
    .trim();

  const normalizeAsciiAlnum = (s: string) =>
    s.replace(/[０-９Ａ-Ｚａ-ｚ．]/g, (ch) => ch.normalize('NFKC'));

  if (cleanPreferredTitle && cleanPreferredTitle !== 'Manga') {
    const normBase = normalizeAsciiAlnum(baseName);

    const rangeMatch = normBase.match(
      /(?:第\s*|vol(?:ume)?\.?\s*|(?<![a-z0-9])v\.?\s*)0*(\d+(?:\.\d+)?)\s*[-〜~–—]\s*(?:第\s*|vol(?:ume)?\.?\s*|v\.?\s*)?0*(\d+(?:\.\d+)?)(?:\s*(?:巻|s\b))?/i
    );
    if (rangeMatch) {
      const startStr = padVolumeNumberStr(rangeMatch[1]);
      const endStr = padVolumeNumberStr(rangeMatch[2]);
      return `${cleanPreferredTitle} 第${startStr}-${endStr}巻.${ext}`;
    }

    let volNumStr = '';
    if (fallbackVolume > 0) {
      volNumStr = padVolumeNumberStr(String(fallbackVolume));
    } else {
      const singleMatch = normBase.match(
        /(?:第\s*0*(\d+(?:\.\d+)?)\s*巻|(?:vol(?:ume)?\.?\s*|(?<![a-z0-9])v\.?\s*)0*(\d+(?:\.\d+)?)(?:\s*(?:巻|s\b))?(?![0-9\-]))/i
      );
      if (singleMatch) {
        volNumStr = padVolumeNumberStr(singleMatch[1] || singleMatch[2]);
      }
    }

    if (volNumStr) {
      return `${cleanPreferredTitle} 第${volNumStr}巻.${ext}`;
    }
    return `${cleanPreferredTitle}.${ext}`;
  }

  let converted = normalizeAsciiAlnum(baseName);

  // 範囲表記 (Vol.1-5 / v01-05 / 第1-5巻 -> 第01-05巻)
  converted = converted.replace(
    /(?:第\s*)?(?:vol(?:ume)?\.?\s*|(?<![a-z0-9])v\.?\s*)0*(\d+(?:\.\d+)?)\s*[-〜~–—]\s*(?:第\s*|vol(?:ume)?\.?\s*|v\.?\s*)?0*(\d+(?:\.\d+)?)\s*(?:巻|s(?![a-z0-9]))?/gi,
    (_, s, e) => `第${padVolumeNumberStr(s)}-${padVolumeNumberStr(e)}巻`
  );
  converted = converted.replace(
    /第\s*0*(\d+(?:\.\d+)?)\s*[-〜~–—]\s*(?:第\s*)?0*(\d+(?:\.\d+)?)\s*巻/g,
    (_, s, e) => `第${padVolumeNumberStr(s)}-${padVolumeNumberStr(e)}巻`
  );

  // 単巻表記 (Vol.X / vol.X / Volume X / v04 / v04s -> 第XX巻)
  converted = converted.replace(
    /(?:vol(?:ume)?\.?\s*|(?<![a-z0-9])v\.?\s*)0*(\d+(?:\.\d+)?)(?:\s*(?:巻|s(?![a-z0-9])))?(?![0-9\-])/gi,
    (_, n) => `第${padVolumeNumberStr(n)}巻`
  );

  // 既存の 第X巻 も2桁以上にゼロ埋め
  converted = converted.replace(
    /第\s*0*(\d+(?:\.\d+)?)\s*巻/g,
    (_, n) => `第${padVolumeNumberStr(n)}巻`
  );

  const safeConverted = converted.trim() || 'Manga';
  return `${safeConverted}.${ext}`;
}


