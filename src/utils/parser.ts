export interface ParseResult {
  rawTitle: string;
  cleanTitle: string;
  normalizedTitle: string;
  category: string;
  author?: string;
  maxVolume: number;
  displayVolume: string;
  rawVolumeStr: string;
  isMagazine: boolean;
  magazineIssue?: string;
}

/**
 * Normalizes text for consistent comparison (NFKC, lowercase, remove extra spaces)
 */
export function normalizeTitle(title: string): string {
  return title
    .normalize('NFKC')
    .toLowerCase()
    .replace(/×/g, 'x')
    .replace(/[\s\-_・:：【】\[\]（）()~～〜!?！？、。「」『』.,'"/／]/g, '')
    .trim();
}

/**
 * Parses a raw post title from DL-RAW.SI into structured manga data.
 */
export function parsePostTitle(rawTitle: string): ParseResult {
  const normalizedRaw = rawTitle.normalize('NFKC').trim();

  // 1. Detect Category
  let category = '一般コミック';
  const categoryMatch = normalizedRaw.match(/^\[(一般コミック|成年コミック|Light Novel|ライトノベル|雑誌|同人誌|その他|コミック|Manga|Novel)\]/i);
  if (categoryMatch) {
    category = categoryMatch[1];
  } else if (/雑誌|マガジン|ジャンプ|サンデー|マガジン|ヤング|ヤンジャン|ガンガン/i.test(normalizedRaw)) {
    category = '雑誌';
  } else if (/novel|ライトノベル|ノベル/i.test(normalizedRaw)) {
    category = 'Light Novel';
  }

  // 2. Check for Magazine with Year format (e.g. 電撃マオウ 2026年01-10月号, 週刊少年ジャンプ 2025年35号)
  const magWithYearPattern = /(\d{4}年)\s*(?:(?:No\.?|第)\s*)?(\d{1,2})(?:[-〜~–—](?:(?:No\.?|第)\s*)?(\d{1,2}))?\s*(月号?|号)?/i;
  const magYearMatch = normalizedRaw.match(magWithYearPattern);

  // General magazine / issue fallback
  const genericMagMatch = normalizedRaw.match(/(\d{4}年\s*\d+号|\d{4}-\d+|\d{4}年\s*\d+月(?:\d+日)?号)/);
  const isMagazine = category === '雑誌' || !!magYearMatch || !!genericMagMatch;
  const magazineIssue = magYearMatch ? magYearMatch[0] : genericMagMatch ? genericMagMatch[1] : undefined;

  // 3. Extract Volume Information
  let maxVolume = 0;
  let displayVolume = '巻数不明';
  let rawVolumeStr = '';

  if (magYearMatch) {
    // Magazine with specific Year: keep the Year in the title, and extract the issue (e.g. 10月号)
    category = '雑誌';
    const year = magYearMatch[1]; // e.g. "2026年"
    const num1 = parseInt(magYearMatch[2], 10);
    const num2 = magYearMatch[3] ? parseInt(magYearMatch[3], 10) : num1;
    maxVolume = Math.max(num1, num2);
    
    // Determine unit ("月号" or "号")
    let unit = magYearMatch[4];
    if (!unit) {
      unit = magYearMatch[0].includes('月') ? '月号' : '号';
    }
    displayVolume = `${maxVolume}${unit}`;

    // rawVolumeStr to be stripped from title (only strip the issue part, KEEP the year in title)
    rawVolumeStr = magYearMatch[0].replace(year, '').trim();
  } else {
    // Volume regex patterns for standard comics (ordered by specificity)
    const compoundVolumePattern = /第?\s*(\d+(?:\.\d+)?)\s*[-〜~–—]\s*第?\s*(\d+(?:\.\d+)?)(?:\s*[\+,、]\s*(\d+(?:\.\d+)?))+\s*巻/i;
    const volumeRangePattern = /第?\s*(\d+(?:\.\d+)?)\s*[-〜~–—]\s*第?\s*(\d+(?:\.\d+)?)\s*巻/i;
    const singleVolumePattern = /第\s*(\d+(?:\.\d+)?)\s*巻/i;
    const volRangePattern = /vol(?:ume)?\.?\s*(\d+(?:\.\d+)?)\s*[-〜~–—]\s*vol(?:ume)?\.?\s*(\d+(?:\.\d+)?)/i;
    const singleVolPattern = /vol(?:ume)?\.?\s*(\d+(?:\.\d+)?)/i;
    const vRangePattern = /\bv(\d+)\s*[-〜~–—]\s*v?(\d+)\b/i;
    const numberRangeKanPattern = /(\d+)\s*[-〜~–—]\s*(\d+)\s*巻/;
    const numberKanPattern = /\b(\d+)\s*巻/;
    const chapterPattern = /第\s*(\d+)\s*話/;

    if (compoundVolumePattern.test(normalizedRaw)) {
      const match = normalizedRaw.match(compoundVolumePattern)!;
      const nums = match[0].match(/\d+(?:\.\d+)?/g)?.map((n) => parseFloat(n)) || [0];
      maxVolume = Math.max(...nums);
      rawVolumeStr = match[0];
      displayVolume = rawVolumeStr.replace(/^第?/, '第');
    } else if (volumeRangePattern.test(normalizedRaw)) {
      const match = normalizedRaw.match(volumeRangePattern)!;
      const start = parseFloat(match[1]);
      const end = parseFloat(match[2]);
      maxVolume = Math.max(start, end);
      displayVolume = `第${match[1]}-${match[2]}巻`;
      rawVolumeStr = match[0];
    } else if (volRangePattern.test(normalizedRaw)) {
      const match = normalizedRaw.match(volRangePattern)!;
      const start = parseFloat(match[1]);
      const end = parseFloat(match[2]);
      maxVolume = Math.max(start, end);
      displayVolume = `vol.${match[1]}-${match[2]}`;
      rawVolumeStr = match[0];
    } else if (vRangePattern.test(normalizedRaw)) {
      const match = normalizedRaw.match(vRangePattern)!;
      const start = parseFloat(match[1]);
      const end = parseFloat(match[2]);
      maxVolume = Math.max(start, end);
      displayVolume = `v${match[1]}-v${match[2]}`;
      rawVolumeStr = match[0];
    } else if (numberRangeKanPattern.test(normalizedRaw)) {
      const match = normalizedRaw.match(numberRangeKanPattern)!;
      const start = parseFloat(match[1]);
      const end = parseFloat(match[2]);
      maxVolume = Math.max(start, end);
      displayVolume = `${match[1]}-${match[2]}巻`;
      rawVolumeStr = match[0];
    } else if (singleVolumePattern.test(normalizedRaw)) {
      const match = normalizedRaw.match(singleVolumePattern)!;
      maxVolume = parseFloat(match[1]);
      displayVolume = `第${match[1]}巻`;
      rawVolumeStr = match[0];
    } else if (numberKanPattern.test(normalizedRaw)) {
      const match = normalizedRaw.match(numberKanPattern)!;
      maxVolume = parseFloat(match[1]);
      displayVolume = `${match[1]}巻`;
      rawVolumeStr = match[0];
    } else if (singleVolPattern.test(normalizedRaw)) {
      const match = normalizedRaw.match(singleVolPattern)!;
      maxVolume = parseFloat(match[1]);
      displayVolume = `vol.${match[1]}`;
      rawVolumeStr = match[0];
    } else if (chapterPattern.test(normalizedRaw)) {
      const match = normalizedRaw.match(chapterPattern)!;
      maxVolume = parseFloat(match[1]);
      displayVolume = `第${match[1]}話`;
      rawVolumeStr = match[0];
    } else if (isMagazine && genericMagMatch) {
      displayVolume = genericMagMatch[1];
      rawVolumeStr = genericMagMatch[1];
      const issueNum = genericMagMatch[1].match(/(\d+)号/);
      if (issueNum) maxVolume = parseInt(issueNum[1], 10);
    }

    // 3-B. Special Patterns (if no standard volume number found)
    if (!rawVolumeStr) {
      // (A) 上下巻 / 上中下巻 / 上巻 / 中巻 / 下巻 / 全N巻
      const jochugePattern = /(?:[\s~～〜\-_・]+)?(上[・\s]?中[・\s]?下巻|上[・\s]?下巻|上巻|中巻|下巻|全[0-9０-９一二三四五六七八九十\d]+巻)/;
      const jochugeMatch = normalizedRaw.match(jochugePattern);
      if (jochugeMatch) {
        rawVolumeStr = jochugeMatch[0];
        const term = jochugeMatch[1].replace(/[\s・]/g, '');
        if (term === '上中下巻') {
          displayVolume = '全３巻';
          maxVolume = 3;
        } else if (term === '上下巻') {
          displayVolume = '全２巻';
          maxVolume = 2;
        } else if (term === '上巻') {
          displayVolume = '上巻';
          maxVolume = 1;
        } else if (term === '中巻') {
          displayVolume = '中巻';
          maxVolume = 2;
        } else if (term === '下巻') {
          displayVolume = '下巻';
          maxVolume = 2;
        } else {
          displayVolume = term;
          maxVolume = 1;
        }
      }
    }

    // (B) 〇〇編 (e.g. 桃編, りんご編)
    if (!rawVolumeStr) {
      const henPattern = /(?:[\s\-_・]+)?([^\s~～〜\-_・\(\)\[\]]{1,15}編)(?:\s|$)/;
      const henMatch = normalizedRaw.match(henPattern);
      if (henMatch) {
        rawVolumeStr = henMatch[0];
        displayVolume = henMatch[1];
        maxVolume = 1;
      }
    }

    // (C) ～サブタイトル～ / 〜サブタイトル〜 (e.g. ～材料を集めよう～ -> 材料を集めよう編)
    if (!rawVolumeStr) {
      const subPattern = /[~～〜]([^~～〜]{1,30})[~～〜]?$/;
      const subMatch = normalizedRaw.match(subPattern);
      if (subMatch) {
        rawVolumeStr = subMatch[0];
        const subtitleContent = subMatch[1].trim();
        if (subtitleContent) {
          displayVolume = subtitleContent.endsWith('編') ? subtitleContent : `${subtitleContent}編`;
          maxVolume = 1;
        }
      }
    }

    // (D) Fallback: If no volume/issue found, treat standalone/single works as "全１巻"
    if (!displayVolume || displayVolume === '巻数不明') {
      displayVolume = '全１巻';
      maxVolume = 1;
    }
  }

  // 4. Extract Author if present (e.g., [作者名] or (作者名))
  let author: string | undefined;
  // Match bracketed author name right after category or at beginning
  const authorMatch = normalizedRaw.match(/(?:^|\]\s*)\[([^\]]{2,20})\](?!\s*\[完|\s*\[DL|\s*\[RAW)/);
  if (authorMatch && !/一般コミック|成年コミック|Light Novel|雑誌|同人誌|その他|DL-RAW|完|RAW/i.test(authorMatch[1])) {
    // Check if it's an English title bracket or author
    if (!/^[a-zA-Z0-9\s\-_.vol]+$/i.test(authorMatch[1])) {
      author = authorMatch[1].trim();
    }
  }

  // 5. Clean Title extraction
  let cleanTitle = normalizedRaw;

  // Remove category tag at start
  cleanTitle = cleanTitle.replace(/^\[(一般コミック|成年コミック|Light Novel|ライトノベル|雑誌|同人誌|その他|コミック|Manga|Novel)\]\s*/i, '');

  // Remove author tag if extracted
  if (author) {
    cleanTitle = cleanTitle.replace(new RegExp(`\\[${escapeRegExp(author)}\\]\\s*`), '');
  }

  // Remove English/Romaji secondary title brackets like [Sousou no Frieren vol 01-13] or [Chainsaw Man 18]
  cleanTitle = cleanTitle.replace(/\[[a-zA-Z0-9\s\-_.',:;!?&()]+\]\s*$/i, '');

  // Remove volume patterns
  if (rawVolumeStr) {
    cleanTitle = cleanTitle.replace(rawVolumeStr, '');
  }

  // Remove common tags like [完], (デジタル版), 【特装版】, raw/RAW, zip, rar, etc.
  cleanTitle = cleanTitle
    .replace(/\[(完|完結|特装版|限定版|デジタル版|カラー版|DL-RAW|RAW)\]/gi, '')
    .replace(/\((完|完結|特装版|限定版|デジタル版|カラー版)\)/gi, '')
    .replace(/【(完|完結|特装版|限定版|デジタル版|カラー版)】/gi, '')
    .replace(/\b(raw|manga|zip|rar|dl-raw)\b/gi, '')
    .trim();

  // Clean trailing punctuation
  cleanTitle = cleanTitle.replace(/[\s\-_・:：]+$/, '').trim();

  // If clean title somehow became empty, fallback to trimmed raw title
  if (!cleanTitle) {
    cleanTitle = rawTitle.replace(/^\[[^\]]+\]\s*/, '').trim() || rawTitle;
  }

  const normalized = normalizeTitle(cleanTitle);

  return {
    rawTitle,
    cleanTitle,
    normalizedTitle: normalized,
    category,
    author,
    maxVolume,
    displayVolume: displayVolume || '不明',
    rawVolumeStr,
    isMagazine,
    magazineIssue,
  };
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
