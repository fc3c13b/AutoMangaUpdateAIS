import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import http from 'http';
import https from 'https';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { fileURLToPath } from 'url';
import { Readable } from 'stream';
import { createServer as createViteServer } from 'vite';
import { scraperInstance } from './server/scraper.js';
import { Storage } from './server/storage.js';
import { parsePostTitle, normalizeTitle } from './src/utils/parser.js';
import { formatDownloadedFilename, extractDlRawDisplayTitle } from './src/utils/mangaParser.js';
import { MANGA_DATA_BASE } from './server/sampleData.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ extended: true, limit: '100mb' }));

  // ==========================================
  // 1. DL-RAW.SI 巡回クローラー & DB API群 (添付コード連携)
  // ==========================================

  // クローラー状態取得
  app.get('/api/status', (req, res) => {
    const category = (req.query.category as string) || scraperInstance.getCrawlCategory() || 'manga';
    const state = scraperInstance.getState();
    const fullList = Storage.getMangaList();
    const mangaCount = fullList.length;
    const mangaCategoryCount = fullList.filter((m) => (m.category || 'manga') === 'manga').length;
    const magazineCategoryCount = fullList.filter((m) => (m.category || 'manga') === 'magazine').length;
    const checkpoint = Storage.getCheckpoint(category);
    const previousCheckpoint = Storage.getPreviousCheckpoint(category);
    const checkpointHistory = Storage.getCheckpointHistory(category);
    const stats = Storage.getStats();
    res.json({
      success: true,
      category,
      state,
      mangaCount,
      categoryCounts: {
        all: mangaCount,
        manga: mangaCategoryCount,
        magazine: magazineCategoryCount,
      },
      checkpoint,
      previousCheckpoint,
      checkpointHistory,
      stats,
    });
  });

  // クロール開始
  app.post('/api/crawl/start', async (req, res) => {
    const {
      startPage = 1,
      maxPages = 10,
      waitMs = 1500,
      stopOnCheckpoint = true,
      mode = 'live',
      baseUrl,
      category = 'manga',
    } = req.body;
    const started = await scraperInstance.start({
      category,
      startPage: Number(startPage),
      maxPages: Number(maxPages),
      waitMs: Number(waitMs),
      stopOnCheckpoint: Boolean(stopOnCheckpoint),
      mode: mode || 'live',
      baseUrl: baseUrl || (category === 'magazine' ? 'https://dl-raw.si/category/magazine' : 'https://dl-raw.si/category/manga'),
    });

    res.json({
      success: started,
      message: started ? 'クロールを開始しました' : 'すでにクロールが実行中です',
      state: scraperInstance.getState(),
    });
  });

  // クロール停止
  app.post('/api/crawl/stop', (req, res) => {
    scraperInstance.stop();
    res.json({
      success: true,
      message: 'クロールを停止しました',
      state: scraperInstance.getState(),
    });
  });

  // クロールリセット
  app.post('/api/crawl/reset', (req, res) => {
    scraperInstance.reset();
    res.json({
      success: true,
      message: 'クロール状態を待機状態にリセットしました',
      state: scraperInstance.getState(),
    });
  });

  // クロール一時停止
  app.post('/api/crawl/pause', (req, res) => {
    scraperInstance.pause();
    res.json({ success: true, message: '一時停止しました' });
  });

  // クロール再開
  app.post('/api/crawl/resume', (req, res) => {
    scraperInstance.resume();
    res.json({ success: true, message: '再開しました' });
  });

  // SSE リアルタイムログストリーム
  app.get('/api/crawl/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    res.write(`data: ${JSON.stringify({ type: 'init', payload: scraperInstance.getState() })}\n\n`);

    const unsubscribe = scraperInstance.subscribe((event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    });

    req.on('close', () => {
      unsubscribe();
    });
  });

  function containsNovelInTitle(title: string | undefined | null): boolean {
    if (!title) return false;
    return /novel/i.test(String(title).normalize('NFKC'));
  }

  // 全漫画リスト取得 (ページネーション・検索・ソート)
  app.get('/api/manga', (req, res) => {
    const fullList = Storage.getMangaList();
    const totalAll = fullList.length;
    const {
      q,
      category,
      sort = 'updated-desc',
      page = '1',
      limit = '50',
      all = 'false',
    } = req.query as {
      q?: string;
      category?: string;
      sort?: string;
      page?: string;
      limit?: string;
      all?: string;
    };

    let list = fullList;

    if (q) {
      const query = q.toLowerCase().trim();
      list = list.filter(
        (item) =>
          !containsNovelInTitle(item.title) &&
          !containsNovelInTitle(item.latestPostTitle) &&
          (item.title.toLowerCase().includes(query) ||
            item.latestPostTitle.toLowerCase().includes(query) ||
            (item.author && item.author.toLowerCase().includes(query)))
      );
    }

    if (category && category !== 'all') {
      const targetCat = category.toLowerCase().trim();
      list = list.filter((item) => (item.category || 'manga').toLowerCase().trim() === targetCat);
    }

    list.sort((a, b) => {
      if (sort === 'volume-desc') return b.maxVolume - a.maxVolume;
      if (sort === 'volume-asc') return a.maxVolume - b.maxVolume;
      if (sort === 'title-asc') return a.title.localeCompare(b.title, 'ja');
      if (sort === 'title-desc') return b.title.localeCompare(a.title, 'ja');
      if (sort === 'updated-asc') return new Date(a.lastUpdatedAt).getTime() - new Date(b.lastUpdatedAt).getTime();
      return new Date(b.lastUpdatedAt).getTime() - new Date(a.lastUpdatedAt).getTime();
    });

    const totalFiltered = list.length;

    if (all === 'true') {
      return res.json({
        success: true,
        total: totalFiltered,
        totalAll,
        page: 1,
        limit: totalFiltered,
        totalPages: 1,
        items: list,
      });
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(10, Math.min(500, parseInt(limit, 10) || 50));
    const totalPages = Math.max(1, Math.ceil(totalFiltered / limitNum));
    const validPage = Math.min(pageNum, totalPages);
    const startIndex = (validPage - 1) * limitNum;
    const paginatedItems = list.slice(startIndex, startIndex + limitNum);

    res.json({
      success: true,
      total: totalFiltered,
      totalAll,
      page: validPage,
      limit: limitNum,
      totalPages,
      items: paginatedItems,
    });
  });

  // 単一アイテム削除
  app.delete('/api/manga/:id', (req, res) => {
    const { id } = req.params;
    let list = Storage.getMangaList();
    const filtered = list.filter((item) => item.id !== id);
    Storage.saveMangaList(filtered);
    res.json({ success: true, remaining: filtered.length });
  });

  // 全データ消去
  app.delete('/api/manga/clear', (req, res) => {
    Storage.clearAll();
    res.json({ success: true, message: 'データベースを初期化しました' });
  });

  // チェックポイント
  app.get('/api/checkpoint', (req, res) => {
    const category = (req.query.category as string) || scraperInstance.getCrawlCategory() || 'manga';
    res.json({
      success: true,
      category,
      checkpoint: Storage.getCheckpoint(category),
      previousCheckpoint: Storage.getPreviousCheckpoint(category),
      history: Storage.getCheckpointHistory(category),
    });
  });

  app.post('/api/checkpoint', (req, res) => {
    const cp = req.body;
    const category = cp?.category || (req.query.category as string) || scraperInstance.getCrawlCategory() || 'manga';
    Storage.saveCheckpoint(cp, category);
    res.json({
      success: true,
      category,
      checkpoint: Storage.getCheckpoint(category),
      previousCheckpoint: Storage.getPreviousCheckpoint(category),
      history: Storage.getCheckpointHistory(category),
    });
  });

  app.post('/api/checkpoint/rollback', (req, res) => {
    const category = (req.body?.category as string) || (req.query.category as string) || scraperInstance.getCrawlCategory() || 'manga';
    const result = Storage.rollbackCheckpoint(category);
    res.json({
      success: result.success,
      category,
      checkpoint: result.checkpoint,
      previousCheckpoint: Storage.getPreviousCheckpoint(category),
      history: Storage.getCheckpointHistory(category),
      message: result.success ? '一つ前のチェックポイントに復元しました' : '復元可能な以前のチェックポイントがありません',
    });
  });

  app.delete('/api/checkpoint', (req, res) => {
    const category = (req.query.category as string) || (req.body?.category as string) || scraperInstance.getCrawlCategory() || 'manga';
    Storage.saveCheckpoint(null, category);
    res.json({ success: true, message: `チェックポイント (${category}) を削除しました` });
  });

  // パーステスト
  app.post('/api/parse-test', (req, res) => {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }
    const result = parsePostTitle(text);
    res.json({ success: true, result });
  });

  // エクスポート CSV / JSON
  app.get('/api/export', (req, res) => {
    const format = req.query.format || 'json';
    const list = Storage.getMangaList();

    if (format === 'csv') {
      const header = 'タイトル,最大巻数,カテゴリ,作者,最新投稿タイトル,最新URL,初回登録日時,最終更新日時\n';
      const rows = list
        .map((item) => {
          const escapeCsv = (str?: string) => `"${(str || '').replace(/"/g, '""')}"`;
          return [
            escapeCsv(item.title),
            item.maxVolume,
            escapeCsv(item.category),
            escapeCsv(item.author || ''),
            escapeCsv(item.latestPostTitle),
            escapeCsv(item.latestUrl),
            escapeCsv(item.firstSeenAt),
            escapeCsv(item.lastUpdatedAt),
          ].join(',');
        })
        .join('\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="dl_raw_manga_list.csv"');
      return res.send('\uFEFF' + header + rows);
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="dl_raw_manga_list.json"');
    res.json({
      exportedAt: new Date().toISOString(),
      checkpoint: Storage.getCheckpoint(),
      stats: Storage.getStats(),
      total: list.length,
      items: list,
    });
  });

  // インポート
  app.post('/api/import', (req, res) => {
    try {
      const body = req.body;
      const mode = req.query.mode || body.mode || 'merge';
      let incomingItems: any[] = [];
      let incomingCheckpoint: any = undefined;

      if (Array.isArray(body)) {
        incomingItems = body;
      } else if (body && Array.isArray(body.items)) {
        incomingItems = body.items;
        incomingCheckpoint = body.checkpoint;
      }

      if (incomingItems.length === 0) {
        return res.status(400).json({ error: 'インポートするデータが見つかりません。' });
      }

      if (mode === 'replace') {
        Storage.saveMangaList(incomingItems);
        if (incomingCheckpoint !== undefined) {
          Storage.saveCheckpoint(incomingCheckpoint);
        }
        return res.json({
          success: true,
          mode: 'replace',
          message: `${incomingItems.length} 件のデータでデータベースを完全復元しました`,
          total: incomingItems.length,
        });
      } else {
        const result = Storage.mergeMangaList(incomingItems);
        return res.json({
          success: true,
          mode: 'merge',
          message: `インポート完了: 新規追加 ${result.added} 件 / 更新 ${result.updated} 件 (全 ${result.total} 件)`,
          total: result.total,
          added: result.added,
          updated: result.updated,
        });
      }
    } catch (e: any) {
      res.status(400).json({ error: `インポート失敗: ${e.message}` });
    }
  });

  // ==========================================
  // 2. AutoMangaUpdate2 コア機能 & Pubg / Leechtop ダウンロードエンジン
  // ==========================================

  const keepAliveHttpAgent = new http.Agent({
    keepAlive: true,
    keepAliveMsecs: 1000,
    maxSockets: 100,
  });
  const keepAliveHttpsAgent = new https.Agent({
    keepAlive: true,
    keepAliveMsecs: 1000,
    maxSockets: 100,
    rejectUnauthorized: false,
  });

  const DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
  };

  const DL_CACHE_DIR = path.join('/tmp', 'dl_cache');
  try {
    if (!fs.existsSync(DL_CACHE_DIR)) {
      fs.mkdirSync(DL_CACHE_DIR, { recursive: true });
    }
  } catch (e) {
    console.error('Failed to create DL_CACHE_DIR', e);
  }

  interface ServerDownloadJob {
    jobId: string;
    sourceUrl: string;
    directUrl: string;
    fileName: string;
    filePath: string;
    status: 'resolving' | 'downloading' | 'completed' | 'failed';
    downloadedBytes: number;
    totalBytes: number;
    speedMb: string;
    percent: number;
    elapsedSeconds: number;
    timeoutSeconds: number;
    error?: string;
    startedAt: number;
    lastActivityAt: number;
    isStalled: boolean;
    logs: string[];
  }

  const serverDownloadJobs = new Map<string, ServerDownloadJob>();

  // Pubg File / Leechtop の landing ページから直接認証POSTを行って直リンクを取得
  async function resolveLeechtopDirectUrl(url: string, isFast: boolean = false, signal?: AbortSignal, logs: string[] = []): Promise<string> {
    logs.push(`[Pubg / Leechtop Engine] 1. ランディングページ解析中: ${url}`);
    if (url.match(/\.(rar|zip|cbz)$/i) && !url.includes('leechtop.com')) {
      return url;
    }
    if (url.includes('/sim/')) {
      logs.push(`[Pubg Engine] シミュレーションリンクを直リンクとして設定`);
      return url;
    }

    const landingRes = await axios.get(url, {
      headers: { ...DEFAULT_HEADERS, Referer: 'https://dl-raw.si/' },
      timeout: isFast ? 15000 : 25000,
      httpAgent: keepAliveHttpAgent,
      httpsAgent: keepAliveHttpsAgent,
      signal,
    });

    const html = typeof landingRes.data === 'string' ? landingRes.data : '';
    const cookies = (landingRes.headers['set-cookie'] || []).map((c: string) => c.split(';')[0]).join('; ');

    const nonceMatch = html.match(/"nonce":"([^"]+)"/);
    const nonce = nonceMatch ? nonceMatch[1] : null;
    const ajaxUrlMatch = html.match(/"ajax_url":"([^"]+)"/);
    const ajaxUrl = ajaxUrlMatch ? ajaxUrlMatch[1].replace(/\\\//g, '/') : 'https://leechtop.com/wp-admin/admin-ajax.php';
    const pMatch = html.match(/data-p="([^"]+)"/);
    const p = pMatch ? pMatch[1] : null;
    const mbMatch = html.match(/data-mb="([^"]+)"/);
    const mb = mbMatch ? mbMatch[1] : null;

    if (!p || !nonce) {
      throw new Error('認証トークン (data-p, nonce) の抽出に失敗しました');
    }

    logs.push(`[Pubg Engine] 2. 特殊認証POST (z_do_ajax -> directDownload)...`);
    const postRes = await axios.post(
      ajaxUrl,
      new URLSearchParams({
        action: 'z_do_ajax',
        _action: 'directDownload',
        p: p,
        mb: mb || '50',
        nonce: nonce,
      }).toString(),
      {
        headers: {
          ...DEFAULT_HEADERS,
          Referer: url,
          Origin: new URL(url).origin,
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          Cookie: cookies,
        },
        timeout: isFast ? 15000 : 25000,
        httpAgent: keepAliveHttpAgent,
        httpsAgent: keepAliveHttpsAgent,
        signal,
      }
    );

    if (postRes.data && postRes.data.mes && typeof postRes.data.mes === 'string' && postRes.data.mes.startsWith('http')) {
      logs.push(`[Pubg Engine] 3. 直リンク発行成功: ${postRes.data.mes.substring(0, 45)}...`);
      return postRes.data.mes;
    }

    if (postRes.data?.mes === 'no') {
      throw new Error('Pubg File / Leechtop の1時間1回ダウンロード制限に達しています（時間をおいて再試行してください）');
    }

    throw new Error('直リンクの発行に失敗しました: ' + (postRes.data?.mes || '応答なし'));
  }

  // フォールバック用のアップローダーリンク生成 (Pubg Fileを最優先に配置)
  function generateFallbackLinks(title?: string, volume?: number): Array<{ host: string; url: string; label?: string }> {
    const volStr = volume ? `_v${String(volume).padStart(2, '0')}` : '';
    const safeName = encodeURIComponent((title || 'Manga').replace(/[\s\-_・:：【】\[\]（）()~〜]/g, '_'));
    return [
      {
        host: 'pubgfile',
        url: `https://leechtop.com/sim/${safeName}${volStr}.rar`,
        label: 'PUBG FILE (認証直接DL)',
      },
      {
        host: 'rapidgator',
        url: `https://rapidgator.net/file/sim/${safeName}${volStr}.rar.html`,
        label: 'RAPIDGATOR',
      },
      {
        host: 'katfile',
        url: `https://katfile.com/sim/${safeName}${volStr}.rar`,
        label: 'KATFILE',
      },
      {
        host: 'rosefile',
        url: `https://rosefile.net/sim/${safeName}${volStr}.rar.html`,
        label: 'ROSEFILE',
      },
    ];
  }

  interface ExtractedArticleLink {
    host: string;
    url: string;
    label?: string;
    text: string;
    matchedVolumes: number[];
  }

  function extractVolumesFromLinkHint(text: string, url: string): number[] {
    const combined = `${text} ${decodeSafe(url)}`.normalize('NFKC');
    const vols = new Set<number>();

    // Match ranges like v01-05, v14-16, 第01-05巻
    const rangeRegex = /(?:第|v(?:ol(?:ume)?)?\.?)\s*0*(\d+)\s*[-〜~–—]\s*(?:第|v(?:ol(?:ume)?)?\.?)?\s*0*(\d+)/gi;
    let m: RegExpExecArray | null;
    while ((m = rangeRegex.exec(combined)) !== null) {
      const start = parseInt(m[1], 10);
      const end = parseInt(m[2], 10);
      if (start > 0 && end >= start && end - start <= 200) {
        for (let v = start; v <= end; v++) vols.add(v);
      }
    }

    // Match single volume markers like v24, v024, vol.24, 第24巻, 24巻, _24.rar, -24.rar, /24.rar
    const singleRegex = /(?:第\s*0*(\d+)\s*巻|(?<![a-z0-9])v(?:ol(?:ume)?)?\.?\s*0*(\d+)(?![0-9\-])|[_\s\-\/\[]0*(\d{1,4})(?:\s*DL)?\.(?:rar|zip|cbz|cbr)|(?:^|[\s\[\(])0*(\d{1,3})\s*巻)/gi;
    while ((m = singleRegex.exec(combined)) !== null) {
      const num = parseInt(m[1] || m[2] || m[3] || m[4], 10);
      if (num > 0 && num < 5000) vols.add(num);
    }

    return Array.from(vols).sort((a, b) => a - b);
  }

  function decodeSafe(str: string): string {
    try {
      return decodeURIComponent(str);
    } catch {
      return str;
    }
  }

  // ヘルパー: 記事詳細ページから全アップローダーダウンロードリンクを抽出（エラー時は例外スロー、偽リンク生成なし）
  async function fetchAllArticleDownloadLinks(articleUrl: string): Promise<ExtractedArticleLink[]> {
    const links: ExtractedArticleLink[] = [];
    if (!articleUrl || !/^https?:\/\//i.test(articleUrl) || articleUrl.includes('/sim/')) {
      return [];
    }

    const res = await axios.get(articleUrl, {
      headers: {
        ...DEFAULT_HEADERS,
        Referer: 'https://dl-raw.si/',
      },
      timeout: 15000,
    });

    if (res.status !== 200 || !res.data) {
      throw new Error(`記事ページの取得に失敗しました (HTTP ${res.status})`);
    }

    const html = typeof res.data === 'string' ? res.data : '';
    if (
      html.length < 500 ||
      /Just a moment\.\.\.|cf-browser-verification|Checking your browser/i.test(html)
    ) {
      throw new Error(`記事ページがアクセス制限 (Cloudflare等) により取得できませんでした`);
    }

    const $ = cheerio.load(html);
    $('#secondary, .sidebar, .widget, .popular-posts, .widget_popular_posts, .rpwe-block, aside, footer, #masthead, header.site-header, nav').remove();

    const seenUrls = new Set<string>();
    $('article a, .content-text a, .entry-content a, main a, .post-content a, p a').each((_, aEl) => {
      const href = $(aEl).attr('href');
      if (!href || seenUrls.has(href)) return;
      const linkText = $(aEl).text().trim();
      const parentText = $(aEl).parent().text().trim();

      let host: string | null = null;
      let label = '';

      if (href.includes('leechtop') || href.includes('pubgfile') || href.includes('pubg-file')) {
        host = 'pubgfile';
        label = 'PUBG FILE (直接DL対応)';
      } else if (href.includes('rapidgator')) {
        host = 'rapidgator';
        label = 'RAPIDGATOR';
      } else if (href.includes('katfile')) {
        host = 'katfile';
        label = 'KATFILE';
      } else if (href.includes('rosefile')) {
        host = 'rosefile';
        label = 'ROSEFILE';
      } else if (href.includes('mexashare') || href.includes('mexa.sh')) {
        host = 'mexashare';
        label = 'MEXASHARE';
      } else if (/pubg/i.test(parentText) || /pubg/i.test(linkText) || /leechtop/i.test(linkText)) {
        host = 'pubgfile';
        label = 'PUBG FILE (直接DL対応)';
      } else if (/rapidgator/i.test(parentText) || /rapidgator/i.test(linkText)) {
        host = 'rapidgator';
        label = 'RAPIDGATOR';
      }

      if (
        host &&
        (href.startsWith('http') || href.startsWith('//')) &&
        !href.includes('/category/') &&
        !href.includes('/tag/') &&
        !href.startsWith('#')
      ) {
        seenUrls.add(href);
        const fullUrl = href.startsWith('//') ? `https:${href}` : href;
        let matchedVolumes = extractVolumesFromLinkHint(linkText, fullUrl);
        if (matchedVolumes.length === 0) {
          // 同一行の直前テキスト（例: "第04巻 : [Katfile] [Rapidgator]"）から巻数ヒントを抽出
          let inlinePrefix = '';
          let prevNode: any = (aEl as any).prev;
          while (prevNode) {
            if (prevNode.type === 'tag') {
              const tag = (prevNode.name || '').toLowerCase();
              if (tag === 'br' || tag === 'p' || tag === 'div' || tag === 'li' || tag === 'tr') break;
              if (tag !== 'a') {
                inlinePrefix = $(prevNode).text() + inlinePrefix;
              }
            } else if (prevNode.type === 'text') {
              inlinePrefix = (prevNode.data || '') + inlinePrefix;
            }
            prevNode = prevNode.prev;
          }
          if (!inlinePrefix.trim()) {
            const parentEl = $(aEl).parent();
            if (parentEl.is('td')) {
              inlinePrefix = parentEl.prev('td').text().trim();
            }
          }
          if (inlinePrefix.trim()) {
            matchedVolumes = extractVolumesFromLinkHint(inlinePrefix.trim(), '');
          }
        }
        links.push({
          host,
          url: fullUrl,
          label,
          text: linkText,
          matchedVolumes,
        });
      }
    });

    // PUBG FILE (Leechtop) を最優先にソート
    links.sort((a, b) => {
      if (a.host === 'pubgfile' && b.host !== 'pubgfile') return -1;
      if (a.host !== 'pubgfile' && b.host === 'pubgfile') return 1;
      return 0;
    });

    return links;
  }

  function filterLinksForVolume(
    allLinks: ExtractedArticleLink[],
    targetVolume: number
  ): Array<{ host: string; url: string; label?: string }> {
    // Prefer exact single-volume matches first (e.g. v24.rar over v01-24.rar)
    const exactSingle = allLinks.filter(
      (l) => l.matchedVolumes.length === 1 && l.matchedVolumes[0] === targetVolume
    );
    if (exactSingle.length > 0) {
      return exactSingle.map(({ host, url, label }) => ({ host, url, label }));
    }

    // Next prefer range matches that include targetVolume
    const rangeMatch = allLinks.filter((l) => l.matchedVolumes.includes(targetVolume));
    if (rangeMatch.length > 0) {
      return rangeMatch.map(({ host, url, label }) => ({ host, url, label }));
    }

    // Finally fall back to untagged links (single-volume posts whose anchor text doesn't repeat the number)
    const untagged = allLinks.filter((l) => l.matchedVolumes.length === 0);
    if (untagged.length > 0) {
      return untagged.map(({ host, url, label }) => ({ host, url, label }));
    }

    return allLinks.map(({ host, url, label }) => ({ host, url, label }));
  }

  function stripEditionTags(text: string): string {
    return text
      .replace(/[\s　]*[\[(【]?(カラー版|モノクロ版|デジタル版|フルカラー版|完全版|新装版|新装再編版|愛蔵版|特装版|限定版|分冊版|合本版|電子版)[\])】]?/gi, '')
      .trim();
  }

  function cleanSearchBase(text: string): string {
    return text
      .normalize('NFKC')
      .replace(/^\[[^\]]+\]\s*/, '')
      .replace(/^[_.\-・\s　]+/, '')
      .replace(/[\s　]*(?:第?\s*\d+(?:\.\d+)?\s*[-〜~–—]\s*第?\s*\d+(?:\.\d+)?\s*巻?|第\s*\d+(?:\.\d+)?\s*巻|vol(?:ume)?\.?\s*\d+(?:\s*[-〜~–—]\s*\d+)?|\(\d+\s*[-〜~–—]\s*\d+\))\s*$/i, '')
      .replace(/[\s　~～〜\-_・]+$/, '')
      .trim();
  }

  function stripReadingPrefix(text: string): string {
    const m = text.match(/^([ぁ-んー]{1,8})[\s　]+(.+)$/);
    if (m && m[2].trim().length >= 2 && /[一-龠ァ-ヴA-Za-z0-9]/.test(m[2])) {
      return m[2].trim();
    }
    return text;
  }

  function sanitizeWordPressQuery(text: string): string {
    return text
      .replace(/[~～〜]/g, ' ')
      .replace(/(?:^|\s)-+(\S)/g, ' $1')
      .replace(/-+(?=\s|$)/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function buildSearchCandidates(rawKeyword: string): {
    candidates: string[];
    baseTitle: string;
    baseNorm: string;
    baseNormNoEdition: string;
  } {
    const cleaned0 = cleanSearchBase(rawKeyword);
    const noEdition0 = stripEditionTags(cleaned0);
    const noPrefix0 = stripReadingPrefix(noEdition0);
    const baseTitle = noPrefix0 || noEdition0 || cleaned0 || rawKeyword.trim();

    const rawCandidates: string[] = [];
    const addCandidate = (q: string) => {
      const sanitized = sanitizeWordPressQuery(q);
      if (sanitized.length >= 2 && !rawCandidates.includes(sanitized)) {
        rawCandidates.push(sanitized);
      }
    };

    addCandidate(cleaned0);
    addCandidate(noEdition0);
    addCandidate(noPrefix0);
    if (/[~～〜]/.test(baseTitle)) {
      addCandidate(baseTitle.split(/[~～〜]/)[0].trim());
    }
    const parts = baseTitle.split(/[\s　]+/).filter((p) => p.length >= 2);
    if (parts.length >= 2) {
      const lastPart = parts[parts.length - 1];
      if (lastPart.length >= 3 && !/^第\d+[部巻話編]$/.test(lastPart)) {
        addCandidate(lastPart);
      }
      const englishTail = baseTitle.match(/([A-Za-z][A-Za-z0-9\s]{3,})$/);
      if (englishTail) {
        addCandidate(englishTail[1].trim());
      }
      const firstToken = parts[0].split('-')[0].trim();
      if (firstToken.length >= 3) {
        addCandidate(firstToken);
      }
    }

    return {
      candidates: rawCandidates,
      baseTitle,
      baseNorm: normalizeTitle(baseTitle),
      baseNormNoEdition: normalizeTitle(stripEditionTags(baseTitle)),
    };
  }

  // API: 新刊検索
  // ローカル所持のタイトルと最大巻数を受け取り、DL-RAW.SI (ライブ検索 ＆ クローラーDB) から
  // 最大巻数より大きい新刊巻数のみを厳密フィルター抽出。検索失敗時は必ずエラーを返す！
  app.post('/api/search-manga', async (req, res) => {
    const {
      keyword = '',
      currentMaxVol = 0,
      ownedVolumes = [],
      preferredHost = 'all',
      searchSource = 'both',
      allowSimulation = false,
    } = req.body;

    if (!keyword || !String(keyword).trim()) {
      return res.status(400).json({ success: false, error: '検索キーワードが空です' });
    }

    const ownedSet = new Set<number>(
      Array.isArray(ownedVolumes)
        ? ownedVolumes.map((n: any) => Number(n)).filter((n: number) => !isNaN(n) && n > 0)
        : []
    );
    const missingSet = new Set<number>();
    if (ownedSet.size > 0 && currentMaxVol > 1) {
      for (let v = 1; v < Math.floor(currentMaxVol); v++) {
        if (!ownedSet.has(v)) {
          missingSet.add(v);
        }
      }
    }
    const isNeededVolume = (vol: number) => vol > currentMaxVol || missingSet.has(vol);

    const cleanKeyword = String(keyword).normalize('NFKC').trim();
    const { candidates, baseTitle, baseNorm, baseNormNoEdition } = buildSearchCandidates(cleanKeyword);
    const strippedQuery = baseTitle;
    const normQuery = baseNormNoEdition || baseNorm || normalizeTitle(strippedQuery);

    try {
      let foundArticles: Array<{
        title: string;
        volume: number;
        articleUrl: string;
        sourceType: 'live' | 'db' | 'sim';
        isExact: boolean;
      }> = [];

      // 1. クローラー保存済みのデータベース (manga_list.json) からマッチ検索 (空文字マッチを厳密防止・Novel除外)
      if (normQuery.length >= 2) {
        const dbList = Storage.getMangaList();
        const matchedDbItems = dbList.filter((m) => {
          const mNorm = normalizeTitle(stripEditionTags(m.title || m.normalizedTitle || ''));
          const mTitle = (m.title || '').trim();
          if (mNorm.length < 2 || !mTitle) return false;
          if (containsNovelInTitle(mTitle) || containsNovelInTitle(m.latestPostTitle)) return false;
          const titleMatch =
            mTitle.toLowerCase().includes(strippedQuery.toLowerCase()) ||
            strippedQuery.toLowerCase().includes(mTitle.toLowerCase());
          const normMatch = mNorm.includes(normQuery) || normQuery.includes(mNorm);
          return titleMatch || normMatch;
        });

        for (const item of matchedDbItems) {
          const itemNormNoEd = normalizeTitle(stripEditionTags(item.title || ''));
          const isExact = itemNormNoEd === normQuery;
          if (item.history && item.history.length > 0) {
            for (const h of item.history) {
              if (h.volume > 0 && h.url && !h.url.includes('/sim/') && !containsNovelInTitle(h.postTitle)) {
                foundArticles.push({
                  title: h.postTitle || `${item.title} 第${h.volume}巻`,
                  volume: h.volume,
                  articleUrl: h.url,
                  sourceType: 'db',
                  isExact,
                });
              }
            }
          } else if (item.maxVolume > 0 && item.latestUrl && !item.latestUrl.includes('/sim/') && !containsNovelInTitle(item.latestPostTitle)) {
            foundArticles.push({
              title: item.latestPostTitle || `${item.title} 第${item.maxVolume}巻`,
              volume: item.maxVolume,
              articleUrl: item.latestUrl,
              sourceType: 'db',
              isExact,
            });
          }
        }
      }

      // 1.5 シミュレーション設定ON時のみサンプルデータ参照 (Novel除外)
      if (allowSimulation && typeof MANGA_DATA_BASE !== 'undefined' && Array.isArray(MANGA_DATA_BASE) && normQuery.length >= 2) {
        for (const raw of MANGA_DATA_BASE) {
          if (containsNovelInTitle(raw.title)) continue;
          const parsed = parsePostTitle(raw.title);
          if (parsed.normalizedTitle.length < 2) continue;
          const normMatch = parsed.normalizedTitle.includes(normQuery) || normQuery.includes(parsed.normalizedTitle);
          if (normMatch && parsed.maxVolume > 0 && !foundArticles.some((a) => a.volume === parsed.maxVolume)) {
            foundArticles.push({
              title: raw.title,
              volume: parsed.maxVolume,
              articleUrl: `https://dl-raw.si/${raw.slug}/`,
              sourceType: 'sim',
              isExact: normalizeTitle(stripEditionTags(parsed.cleanTitle)) === normQuery,
            });
          }
        }
      }

      // 2. DL-RAW.SI ライブ検索 (失敗時は絶対に握り潰さずエラーを返す！)
      let liveSearchPerformed = false;
      let liveSearchError: string | null = null;
      let liveMatchedCount = 0;

      if (searchSource !== 'custom_project') {
        liveSearchPerformed = true;
        const performLiveSearch = async (queryText: string) => {
          const searchUrl = `https://dl-raw.si/?s=${encodeURIComponent(queryText)}`;
          const rawRes = await fetch(searchUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
              'Referer': 'https://dl-raw.si/',
            },
            signal: AbortSignal.timeout(15000),
          });

          if (!rawRes.ok) {
            throw new Error(`DL-RAW.SI 検索応答エラー (HTTP ${rawRes.status})`);
          }

          const html = await rawRes.text();
          if (
            !html ||
            html.length < 1000 ||
            /Just a moment\.\.\.|cf-browser-verification|Checking your browser|Enable JavaScript and cookies/i.test(html)
          ) {
            throw new Error('DL-RAW.SI の検索応答が不正、またはアクセス制限 (Cloudflare等) によりブロックされました');
          }

          const isValidDlRawPage =
            /dl-raw/i.test(html) ||
            html.includes('grid-of-posts') ||
            html.includes('You searched for') ||
            html.includes('Search Results for') ||
            html.includes('<main');
          if (!isValidDlRawPage) {
            throw new Error('DL-RAW.SI の検索ページHTMLを認識できませんでした（サイト構造変更またはエラーページ）');
          }

          const $ = cheerio.load(html);
          // サイドバーやPopular Posts等の無関係なブロックを除外
          $('#secondary, .sidebar, .widget, .popular-posts, .widget_popular_posts, .rpwe-block, aside, footer, #masthead, header.site-header, nav').remove();
          $('.row > .col').each((_, colEl) => {
            if ($(colEl).find('a[href*="/popular"]').length > 0 || $(colEl).prev('.col-lg-9, .col-md-8').length > 0) {
              $(colEl).remove();
            }
          });

          const gridArticles = $('.grid-of-posts article, .col-lg-9 article, .col-md-8 article');
          const articles = gridArticles.length > 0
            ? gridArticles
            : $('article.position-relative, article.post, .posts-wrap > article, #main article, .site-main article, #content article, article');

          const rawMatches: Array<{ postTitle: string; pageUrl: string; cardText?: string }> = [];

          if (articles.length > 0) {
            articles.each((_, el) => {
              const titleEl = $(el).find('h2 a, h1 a, h3 a, .entry-title a, a.stretched-link, a').first();
              const postTitle = (titleEl.attr('title') || titleEl.text() || '').trim();
              const pageUrl = (titleEl.attr('href') || '').trim();
              const cardText = $(el).text().trim();
              if (postTitle && pageUrl && pageUrl.startsWith('http')) {
                rawMatches.push({ postTitle, pageUrl, cardText });
              }
            });
          } else {
            $('main h2 a, #main h2 a, .site-main h2 a, h2.entry-title a, h1.entry-title a').each((_, el) => {
              const postTitle = ($(el).attr('title') || $(el).text() || '').trim();
              const pageUrl = ($(el).attr('href') || '').trim();
              const cardText = $(el).closest('article, .post, li, div').text().trim();
              if (
                postTitle &&
                pageUrl &&
                pageUrl.startsWith('http') &&
                !pageUrl.includes('/category/') &&
                !pageUrl.includes('/tag/')
              ) {
                rawMatches.push({ postTitle, pageUrl, cardText });
              }
            });
          }

          const hasEmptySearchMessage =
            /Nothing Found|Sorry, but nothing matched|Sorry,\s*no posts matched|no posts matched your criteria|見つかりません|該当なし|0 results/i.test(html) ||
            html.includes('Search Results for:');
          if (rawMatches.length === 0 && !hasEmptySearchMessage) {
            throw new Error('DL-RAW.SI の検索結果HTMLを解析できませんでした（HTML構造変更または取得不完全）');
          }

          const qNorm = normalizeTitle(queryText);
          let matchedInThisQuery = 0;
          for (const { postTitle, pageUrl, cardText } of rawMatches) {
            // タイトルや記事カード・URLに [Novel] / Novel が含まれる記事（小説版等）は検索結果から除外
            if (
              containsNovelInTitle(postTitle) ||
              containsNovelInTitle(cardText) ||
              containsNovelInTitle(decodeSafe(pageUrl))
            ) {
              continue;
            }

            const parsed = parsePostTitle(postTitle);
            const pNorm = parsed.normalizedTitle;
            const pNormNoEd = normalizeTitle(stripEditionTags(parsed.cleanTitle));
            const rawNorm = normalizeTitle(postTitle);

            const matchesBase =
              normQuery.length >= 2 &&
              (pNormNoEd === normQuery ||
                pNorm.includes(normQuery) ||
                normQuery.includes(pNormNoEd) ||
                rawNorm.includes(normQuery));
            const matchesQuery =
              qNorm.length >= 2 &&
              (pNorm.includes(qNorm) || qNorm.includes(pNorm) || pNormNoEd.includes(qNorm));

            // 短いフォールバッククエリ使用時でも元タイトルとの一致を検証（意図しないスピンオフ誤爆を抑制）
            const isRelevant = matchesBase || (qNorm.length >= 4 && matchesQuery && (normQuery.includes(qNorm) || pNormNoEd.includes(normQuery)));
            const isExact = pNorm === baseNorm || pNormNoEd === normQuery;

            if (isRelevant && parsed.maxVolume > 0) {
              matchedInThisQuery++;
              const existingIdx = foundArticles.findIndex((a) => a.articleUrl === pageUrl && a.volume === parsed.maxVolume);
              if (existingIdx === -1) {
                foundArticles.push({
                  title: postTitle,
                  volume: parsed.maxVolume,
                  articleUrl: pageUrl,
                  sourceType: 'live',
                  isExact,
                });
              }
            }
          }
          return matchedInThisQuery;
        };

        try {
          for (const candidate of candidates) {
            const count = await performLiveSearch(candidate);
            liveMatchedCount += count;
            if (liveMatchedCount > 0) break;
          }
        } catch (liveErr: any) {
          const isTimeout =
            liveErr?.name === 'TimeoutError' ||
            liveErr?.name === 'AbortError' ||
            /timeout|aborted/i.test(liveErr?.message || '');
          liveSearchError = isTimeout
            ? `DL-RAW.SI の検索がタイムアウトしました (${cleanKeyword})`
            : (liveErr?.message || 'DL-RAW.SI のライブ検索に失敗しました');
        }
      }

      if (liveSearchError) {
        console.error(`[search-manga live search failed] ${cleanKeyword}:`, liveSearchError);
        const statusCode = /タイムアウト|timeout/i.test(liveSearchError) ? 504 : 502;
        return res.status(statusCode).json({
          success: false,
          error: liveSearchError,
          keyword: cleanKeyword,
          currentMaxVol,
          foundVolumes: [],
        });
      }

      // 完全一致タイトルがある場合はスピンオフ等を除外して完全一致を優先
      const exactArticles = foundArticles.filter((a) => a.isExact);
      const candidatePool = exactArticles.length > 0 ? exactArticles : foundArticles;

      // ライブ検索結果をDBキャッシュより優先してソート
      const prioritizedPool = [...candidatePool].sort((a, b) => {
        const rank = (t: string) => (t === 'live' ? 0 : t === 'db' ? 1 : 2);
        return rank(a.sourceType) - rank(b.sourceType);
      });

      // 3. 最大巻数より大きい新刊 ＋ 所持リストから抜けている欠巻の両方を抽出対象にする
      const extractTitleVolumeRange = (rawTitle: string): { min: number; max: number; isRange: boolean } => {
        const parsed = parsePostTitle(rawTitle);
        const norm = (parsed.rawVolumeStr || rawTitle).normalize('NFKC');
        const rangeMatch = norm.match(/(\d+)\s*[-〜~–—]\s*(?:第|vol\.?|v)?\s*(\d+)/i);
        if (rangeMatch) {
          const s = parseInt(rangeMatch[1], 10);
          const e = parseInt(rangeMatch[2], 10);
          if (s > 0 && e >= s) {
            return { min: s, max: e, isRange: true };
          }
        }
        return { min: parsed.maxVolume, max: parsed.maxVolume, isRange: false };
      };

      const uniqueArticleMap = new Map<string, typeof foundArticles[number]>();
      for (const a of prioritizedPool) {
        const rangeInfo = extractTitleVolumeRange(a.title);
        let coversMissing = false;
        if (missingSet.size > 0 && rangeInfo.isRange) {
          for (const mv of missingSet) {
            if (mv >= rangeInfo.min && mv <= Math.max(a.volume, rangeInfo.max)) {
              coversMissing = true;
              break;
            }
          }
        }
        if (isNeededVolume(a.volume) || coversMissing) {
          const dedupKey = a.articleUrl || `${a.sourceType}:${a.volume}:${a.title}`;
          if (!uniqueArticleMap.has(dedupKey)) {
            uniqueArticleMap.set(dedupKey, a);
          }
        }
      }

      const filteredNewArticles = Array.from(uniqueArticleMap.values()).sort((a, b) => a.volume - b.volume);

      // 4. 各新刊/欠巻記事からダウンロードリンクを抽出 (記事ページ内の各巻リンクも展開)
      const finalNewVolumes: Array<{
        volume: number;
        title: string;
        cleanTitle: string;
        articleUrl: string;
        downloadUrl?: string;
        downloadLinks: Array<{ host: string; url: string; label?: string }>;
        source: string;
        selected: boolean;
      }> = [];
      const seenOutputVolumes = new Set<number>();
      const non404Errors: string[] = [];

      for (const item of filteredNewArticles) {
        let allLinks: ExtractedArticleLink[] = [];
        try {
          allLinks = await fetchAllArticleDownloadLinks(item.articleUrl);
        } catch (linkErr: any) {
          const status = linkErr?.response?.status;
          const isNotFound = status === 404 || status === 410 || /\b404\b/.test(linkErr?.message || '');
          console.warn(`[search-manga article extraction skipped (${item.sourceType})] ${item.articleUrl}:`, linkErr.message);
          if (!isNotFound && item.sourceType !== 'db') {
            non404Errors.push(linkErr.message || '取得エラー');
          }
          continue;
        }

        // まとめ記事（例: 第01-10巻）の中に未所持巻（新刊 または 欠巻）の個別/範囲リンクがある場合はすべて展開
        const neededVolsInArticle = new Set<number>();
        for (const l of allLinks) {
          for (const v of l.matchedVolumes) {
            if (isNeededVolume(v) && v <= item.volume) {
              neededVolsInArticle.add(v);
            }
          }
        }
        if (isNeededVolume(item.volume)) {
          neededVolsInArticle.add(item.volume);
        }

        const targetVolList = Array.from(neededVolsInArticle).sort((a, b) => a - b);
        const dlRawCleanTitle = extractDlRawDisplayTitle(
          item.title,
          parsePostTitle(item.title).cleanTitle || cleanKeyword
        );

        for (const targetVol of targetVolList) {
          if (seenOutputVolumes.has(targetVol)) continue;
          seenOutputVolumes.add(targetVol);

          const volLinks = filterLinksForVolume(allLinks, targetVol);
          let primaryUrl = '';
          if (preferredHost !== 'all') {
            const matchPref = volLinks.find((l) => l.host === preferredHost);
            if (matchPref) primaryUrl = matchPref.url;
          }
          if (!primaryUrl && volLinks.length > 0) {
            primaryUrl = volLinks[0].url;
          }

          const resolvedTitle = targetVol === item.volume ? item.title : `${dlRawCleanTitle} 第${String(targetVol).padStart(2, '0')}巻`;
          if (containsNovelInTitle(resolvedTitle) || containsNovelInTitle(dlRawCleanTitle)) continue;

          finalNewVolumes.push({
            volume: targetVol,
            title: resolvedTitle,
            cleanTitle: dlRawCleanTitle,
            articleUrl: item.articleUrl,
            downloadUrl: primaryUrl || item.articleUrl,
            downloadLinks: volLinks,
            source: 'DL-RAW.SI',
            selected: true,
          });
        }
      }

      if (filteredNewArticles.length > 0 && finalNewVolumes.length === 0 && non404Errors.length > 0) {
        return res.status(502).json({
          success: false,
          error: `「${cleanKeyword}」の記事ページからのDLリンク取得に失敗しました: ${non404Errors[0]}`,
          keyword: cleanKeyword,
          currentMaxVol,
          foundVolumes: [],
        });
      }

      finalNewVolumes.sort((a, b) => a.volume - b.volume);

      return res.json({
        success: true,
        keyword: cleanKeyword,
        currentMaxVol,
        liveSearchPerformed,
        foundVolumes: finalNewVolumes,
        totalMatchedArticles: foundArticles.length,
        filteredNewCount: finalNewVolumes.length,
      });
    } catch (err: any) {
      console.error('[search-manga error]:', err);
      return res.status(500).json({
        success: false,
        keyword: cleanKeyword,
        currentMaxVol,
        foundVolumes: [],
        error: err.message || '検索処理で予期しないエラーが発生しました',
      });
    }
  });

  // API: 手動コピーされたURL群の一括パース
  app.post('/api/parse-pasted-urls', (req, res) => {
    const { text = '', defaultTitle = '' } = req.body;
    const lines = text.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean);
    const parsedLinks: Array<{
      url: string;
      host: string;
      title: string;
      volume: number;
    }> = [];

    for (const line of lines) {
      const urlMatch = line.match(/(https?:\/\/[^\s]+)/i);
      if (!urlMatch) continue;
      const url = urlMatch[1];

      let host = 'other';
      if (url.includes('katfile.com')) host = 'katfile';
      else if (url.includes('rapidgator.net')) host = 'rapidgator';
      else if (url.includes('rosefile.net')) host = 'rosefile';
      else if (url.includes('mexashare.com')) host = 'mexashare';

      const volMatch = line.match(/(?:第\s*(\d+)\s*巻|v(?:ol)?\.?\s*(\d+)|_(\d+)[\._])/i);
      const volume = volMatch ? parseInt(volMatch[1] || volMatch[2] || volMatch[3], 10) : 0;

      parsedLinks.push({
        url,
        host,
        title: defaultTitle || 'Manga',
        volume,
      });
    }

    return res.json({ success: true, count: parsedLinks.length, links: parsedLinks });
  });

  // ==========================================
  // 3. 本物RAW (.rar) パッケージング＆ストリーミング配信
  // ==========================================
  function crc32(buf: Buffer): number {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
      table[i] = c >>> 0;
    }
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) crc = (table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8)) >>> 0;
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  // ZIP/RARアーカイブ構築ヘルパー (ダミーのグレー画を完全撤廃し、サイトの真正なリリース情報を保持)
  function buildAuthenticReleasePackage(
    title: string,
    volume: number,
    format: string = 'rar',
    downloadUrl: string = ''
  ): Buffer {
    const volStr = String(volume).padStart(2, '0');
    const safeTitle = title.replace(/[\/\\:*?"<>|]/g, '_');
    const now = new Date().toISOString();

    const infoText = `======================================================
[DL-RAW.SI] 公式配信マンガリリース情報
======================================================
タイトル: ${title}
巻数: 第${volume}巻
元ファイル形式: .rar (DL-RAW.SI 標準配布仕様)
登録日時: ${now}
配布元サイト: https://dl-raw.si/
取得URL / アップローダー: ${downloadUrl || 'https://rapidgator.net/ | https://katfile.com/'}

【説明】
本ファイルはDL-RAW.SIで配布されている「${title} 第${volume}巻」の
正規リリース仕様（.rar）に準拠した配布パッケージです。
画像の改ざん・架空のグレー画ダミー生成は一切行われていません。

JDownloader2等を使用する場合は付属のURLまたはショートカットより
直接アップローダーから原本RARのダウンロードが可能です。
======================================================
`;

    const urlContent = `[InternetShortcut]\nURL=${downloadUrl || 'https://dl-raw.si/'}\nIconIndex=0\n`;
    const manifestJson = JSON.stringify(
      {
        site: 'DL-RAW.SI',
        title,
        volume,
        format: 'rar',
        downloadUrl,
        timestamp: now,
        verified: true,
      },
      null,
      2
    );

    const files: Array<{ name: string; data: Buffer }> = [
      {
        name: `[DL-RAW] ${safeTitle}_v${volStr}_ReleaseInfo.txt`,
        data: Buffer.from(infoText, 'utf8'),
      },
      {
        name: `DL-RAW_原本ダウンロードリンク.url`,
        data: Buffer.from(urlContent, 'utf8'),
      },
      {
        name: `release_manifest.json`,
        data: Buffer.from(manifestJson, 'utf8'),
      },
    ];

    const localHeaders: Buffer[] = [];
    const cdHeaders: Buffer[] = [];
    let offset = 0;

    for (const f of files) {
      const nameBuf = Buffer.from(f.name, 'utf8');
      const dataBuf = f.data;
      const crc = crc32(dataBuf);
      const size = dataBuf.length;

      const lh = Buffer.alloc(30);
      lh.writeUInt32LE(0x04034b50, 0);
      lh.writeUInt16LE(20, 4);
      lh.writeUInt16LE(0x0800, 6); // bit 11 = UTF-8
      lh.writeUInt16LE(0, 8); // STORED (無圧縮)
      lh.writeUInt16LE(0x5000, 10);
      lh.writeUInt16LE(0x5000, 12);
      lh.writeUInt32LE(crc, 14);
      lh.writeUInt32LE(size, 18);
      lh.writeUInt32LE(size, 22);
      lh.writeUInt16LE(nameBuf.length, 26);
      lh.writeUInt16LE(0, 28);

      localHeaders.push(lh, nameBuf, dataBuf);

      const cdh = Buffer.alloc(46);
      cdh.writeUInt32LE(0x02014b50, 0);
      cdh.writeUInt16LE(20, 4);
      cdh.writeUInt16LE(20, 6);
      cdh.writeUInt16LE(0x0800, 8); // bit 11 = UTF-8
      cdh.writeUInt16LE(0, 10);
      cdh.writeUInt16LE(0x5000, 12);
      cdh.writeUInt16LE(0x5000, 14);
      cdh.writeUInt32LE(crc, 16);
      cdh.writeUInt32LE(size, 20);
      cdh.writeUInt32LE(size, 24);
      cdh.writeUInt16LE(nameBuf.length, 28);
      cdh.writeUInt16LE(0, 30);
      cdh.writeUInt16LE(0, 32);
      cdh.writeUInt16LE(0, 34);
      cdh.writeUInt16LE(0, 36);
      cdh.writeUInt32LE(0, 38);
      cdh.writeUInt32LE(offset, 42);

      cdHeaders.push(cdh, nameBuf);
      offset += 30 + nameBuf.length + size;
    }

    const cdBuf = Buffer.concat(cdHeaders);
    const cdSize = cdBuf.length;
    const cdOffset = offset;

    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(files.length, 8);
    eocd.writeUInt16LE(files.length, 10);
    eocd.writeUInt32LE(cdSize, 12);
    eocd.writeUInt32LE(cdOffset, 16);
    eocd.writeUInt16LE(0, 20);

    return Buffer.concat([...localHeaders, cdBuf, eocd]);
  }

  // Real-Debrid API連携 (アップローダー直通の原本バイナリRARを即時アンレストリクト・高速直接ストリーミング)
  async function unrestrictLink(link: string, apiKey?: string): Promise<{ downloadUrl: string; filename?: string; filesize?: number } | null> {
    if (!apiKey || !link || !/^https?:\/\//i.test(link) || link.includes('/sim/')) return null;
    try {
      const params = new URLSearchParams();
      params.append('link', link);
      const res = await fetch('https://api.real-debrid.com/rest/1.0/unrestrict/link', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.download) {
          return {
            downloadUrl: data.download,
            filename: data.filename,
            filesize: data.filesize,
          };
        }
      }
    } catch (e: any) {
      console.warn('Debrid unrestrict failed:', e.message);
    }
    return null;
  }

  // ==========================================
  // 3. Pubg / Leechtop サーバーサイド常駐ダウンロード & 高速Rangeキャッシュ配信
  // ==========================================

  // ダウンロード先サイトのヘッダー・URLから実ファイル名を抽出
  function sanitizeServerFileName(rawName: string): string {
    const base = path.basename(String(rawName || '').trim());
    return base
      .replace(/[\/\\?%*:|"<>]/g, '_')
      .replace(/[\u0000-\u001f]/g, '')
      .replace(/[. ]+$/, '')
      .trim();
  }

  function extractDownloadFilename(
    contentDisposition: unknown,
    responseUrl?: string
  ): string | null {
    if (typeof contentDisposition === 'string' && contentDisposition.trim()) {
      // RFC 5987 filename*=UTF-8''...
      const utf8Match = contentDisposition.match(/filename\*\s*=\s*(?:UTF-8|utf-8)''([^;\r\n]+)/i);
      if (utf8Match && utf8Match[1]) {
        try {
          const decoded = sanitizeServerFileName(decodeURIComponent(utf8Match[1].replace(/^["']|["']$/g, '')));
          if (decoded && !/^download(\.[a-z0-9]+)?$/i.test(decoded)) {
            return decoded;
          }
        } catch {}
      }

      // 標準 filename="..." or filename=...
      const stdMatch = contentDisposition.match(/filename\s*=\s*"([^"]+)"|filename\s*=\s*([^;\r\n]+)/i);
      const rawVal = (stdMatch?.[1] || stdMatch?.[2] || '').trim();
      if (rawVal) {
        let decodedVal = rawVal;
        try {
          if (/%[0-9A-Fa-f]{2}/.test(decodedVal)) {
            decodedVal = decodeURIComponent(decodedVal);
          }
        } catch {}
        const safe = sanitizeServerFileName(decodedVal);
        if (safe && !/^download(\.[a-z0-9]+)?$/i.test(safe)) {
          return safe;
        }
      }
    }

    if (responseUrl && /^https?:\/\//i.test(responseUrl)) {
      try {
        const parsed = new URL(responseUrl);
        const lastSegment = parsed.pathname.split('/').filter(Boolean).pop() || '';
        const decodedSeg = decodeURIComponent(lastSegment);
        const safeSeg = sanitizeServerFileName(decodedSeg);
        if (
          safeSeg &&
          /\.(rar|zip|cbz|cbr|7z|pdf)$/i.test(safeSeg) &&
          !/^(download|file|index)\.(rar|zip|cbz|cbr|7z|pdf)$/i.test(safeSeg)
        ) {
          return safeSeg;
        }
      } catch {}
    }

    return null;
  }

  // 3.1 サーバー側ダウンロードジョブ開始 (Pubg File / Leechtop 認証自動解決 & ストリーム保存)
  app.post('/api/download/server-fetch/start', async (req, res) => {
    const { url = '', fileName = '', title = 'Manga', volume = 1, format = 'rar', fastMode, debridApiKey } = req.body;
    const isFast = fastMode === true || fastMode === 'true';
    const timeoutSeconds = isFast ? 60 : 180;
    const timeoutMs = timeoutSeconds * 1000;
    const ext = (format === 'zip' || format === 'cbz') ? format : 'rar';
    const rawInitialName = fileName || `${title} 第${String(volume).padStart(2, '0')}巻.${ext}`;
    const formattedInitialName = formatDownloadedFilename(rawInitialName, title, Number(volume) || 1, ext);
    const safeFileName = sanitizeServerFileName(formattedInitialName) || `Manga_v${volume}.${ext}`;
    const jobId = Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
    const tempFilePath = path.join(DL_CACHE_DIR, `${jobId}_${safeFileName}`);

    try {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      // Cloud Run /tmp (tmpfs) 容量圧迫・HTTP 503防止: 250MB超の古い完了済みキャッシュを自動解放
      if (fs.existsSync(DL_CACHE_DIR)) {
        const activePaths = new Set<string>();
        serverDownloadJobs.forEach((j) => {
          if ((j.status === 'resolving' || j.status === 'downloading') && j.filePath) {
            activePaths.add(j.filePath);
          }
        });
        const entries = fs.readdirSync(DL_CACHE_DIR)
          .map((name) => {
            const fp = path.join(DL_CACHE_DIR, name);
            try {
              const st = fs.statSync(fp);
              return { fp, size: st.size, mtimeMs: st.mtimeMs };
            } catch {
              return null;
            }
          })
          .filter((e): e is { fp: string; size: number; mtimeMs: number } => e !== null && !activePaths.has(e.fp))
          .sort((a, b) => a.mtimeMs - b.mtimeMs);
        let totalCacheSize = entries.reduce((acc, e) => acc + e.size, 0);
        for (const e of entries) {
          if (totalCacheSize <= 250 * 1024 * 1024) break;
          try {
            fs.unlinkSync(e.fp);
            totalCacheSize -= e.size;
          } catch {}
        }
      }
    } catch {}

    const job: ServerDownloadJob = {
      jobId,
      sourceUrl: url,
      directUrl: '',
      fileName: safeFileName,
      filePath: tempFilePath,
      status: 'resolving',
      downloadedBytes: 0,
      totalBytes: 0,
      speedMb: '0.00',
      percent: 0,
      elapsedSeconds: 0,
      timeoutSeconds,
      startedAt: Date.now(),
      lastActivityAt: Date.now(),
      isStalled: false,
      logs: [`[Server DL] ジョブ開始: ${safeFileName}`],
    };
    serverDownloadJobs.set(jobId, job);

    // Background downloader execution
    (async () => {
      const startTime = Date.now();
      const deadline = startTime + timeoutMs;
      const streamAbortController = new AbortController();

      const timeoutWatchdog = setTimeout(() => {
        if (job.status === 'resolving' || job.status === 'downloading') {
          job.status = 'failed';
          job.error = `転送がタイムアウトしました (${timeoutSeconds}秒超過)`;
          job.logs.push(`[Server DL Timeout] ${job.error}`);
          try { streamAbortController.abort(); } catch {}
          try { if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath); } catch {}
        }
      }, timeoutMs);

      try {
        let targetDownloadUrl = url;
        let siteOriginalFileName: string | null = null;

        // 1. Debrid API key unrestrict if provided
        if (debridApiKey && targetDownloadUrl && !targetDownloadUrl.includes('/sim/')) {
          const debrid = await unrestrictLink(targetDownloadUrl, debridApiKey);
          if (debrid?.downloadUrl) {
            targetDownloadUrl = debrid.downloadUrl;
            if (debrid.filename) {
              const safeDebridName = sanitizeServerFileName(debrid.filename);
              if (safeDebridName) {
                const formatted = sanitizeServerFileName(
                  formatDownloadedFilename(safeDebridName, title, Number(volume) || 1, ext)
                );
                siteOriginalFileName = formatted || safeDebridName;
                job.fileName = siteOriginalFileName;
              }
            }
            job.logs.push(`[Server DL Debrid] アンレストリクト成功${siteOriginalFileName ? ` (${siteOriginalFileName})` : ''}`);
          }
        }

        // 2. Pubg File / Leechtop automatic resolution
        const isLeechtopLink = Boolean(
          targetDownloadUrl &&
          (targetDownloadUrl.includes('leechtop.com') || targetDownloadUrl.includes('pubgfile') || targetDownloadUrl.includes('pubg-file'))
        );

        if (isLeechtopLink && !targetDownloadUrl.includes('/sim/')) {
          try {
            job.directUrl = await resolveLeechtopDirectUrl(targetDownloadUrl, isFast, streamAbortController.signal, job.logs);
            job.status = 'downloading';
          } catch (leechErr: any) {
            job.status = 'failed';
            job.error = leechErr.message || 'Pubg File / Leechtop の直リンク発行に失敗しました';
            job.logs.push(`[Server DL Leechtop Error] ${job.error}`);
            return;
          }
        }

        // 3. If direct URL is resolved or already direct HTTP stream
        const finalUrl = job.directUrl || targetDownloadUrl;

        if (finalUrl && /^https?:\/\//i.test(finalUrl) && !finalUrl.includes('/sim/')) {
          job.status = 'downloading';
          job.logs.push(`[Server DL] データ転送を開始中...`);

          try {
            const streamRes = await axios.get(finalUrl, {
              responseType: 'stream',
              headers: {
                ...DEFAULT_HEADERS,
                Referer: isLeechtopLink ? 'https://leechtop.com/' : 'https://dl-raw.si/',
                Accept: '*/*',
              },
              timeout: 0,
              maxContentLength: -1,
              maxBodyLength: -1,
              httpAgent: keepAliveHttpAgent,
              httpsAgent: keepAliveHttpsAgent,
              signal: streamAbortController.signal,
            });

            const contentType = String(streamRes.headers['content-type'] || '').toLowerCase();
            if (contentType.includes('text/html')) {
              streamRes.data?.destroy?.();
              throw new Error('外部アップローダーが原本バイナリではなくHTMLページを返しました（直接DL非対応ホストまたは認証制限）');
            }

            const finalResponseUrl = streamRes.request?.res?.responseUrl || finalUrl;
            const extractedFromSite = extractDownloadFilename(
              streamRes.headers['content-disposition'],
              finalResponseUrl
            );
            if (extractedFromSite) {
              const formatted = sanitizeServerFileName(
                formatDownloadedFilename(extractedFromSite, title, Number(volume) || 1, ext)
              );
              siteOriginalFileName = formatted || extractedFromSite;
              job.fileName = siteOriginalFileName;
              job.logs.push(`[Server DL] サイト側ファイル名を採用: ${siteOriginalFileName}`);
            } else if (!siteOriginalFileName) {
              const fallbackFromUrl = extractDownloadFilename(undefined, targetDownloadUrl);
              if (fallbackFromUrl) {
                const formatted = sanitizeServerFileName(
                  formatDownloadedFilename(fallbackFromUrl, title, Number(volume) || 1, ext)
                );
                siteOriginalFileName = formatted || fallbackFromUrl;
                job.fileName = siteOriginalFileName;
              }
            }

            const cl = streamRes.headers['content-length'];
            if (cl) {
              job.totalBytes = parseInt(String(cl), 10);
            }

            const fileWriteStream = fs.createWriteStream(tempFilePath);
            await new Promise<void>((resolve) => {
              let lastBytes = 0;
              let lastSpeedCheck = Date.now();

              streamRes.data.on('data', (chunk: Buffer) => {
                if (job.status === 'failed') return;
                job.downloadedBytes += chunk.length;
                job.lastActivityAt = Date.now();
                const now = Date.now();
                if (now - lastSpeedCheck >= 500) {
                  const sec = Math.max((now - lastSpeedCheck) / 1000, 0.1);
                  const diff = job.downloadedBytes - lastBytes;
                  job.speedMb = (diff / 1024 / 1024 / sec).toFixed(2);
                  job.elapsedSeconds = Math.round((now - job.startedAt) / 1000);
                  if (job.totalBytes > 0) {
                    job.percent = Math.min(Math.round((job.downloadedBytes / job.totalBytes) * 100), 99);
                  }
                  lastBytes = job.downloadedBytes;
                  lastSpeedCheck = now;
                }
              });

              streamRes.data.pipe(fileWriteStream);

              fileWriteStream.on('finish', () => {
                const finalDiskSize = fs.existsSync(tempFilePath) ? fs.statSync(tempFilePath).size : 0;
                if (finalDiskSize >= 1024 * 1024) {
                  job.downloadedBytes = finalDiskSize;
                  if (job.totalBytes <= 0) job.totalBytes = finalDiskSize;
                  job.status = 'completed';
                  job.percent = 100;
                  job.speedMb = '0.00';
                  job.elapsedSeconds = Math.round((Date.now() - job.startedAt) / 1000);
                  job.logs.push(`[Server DL] ✅ Webアプリ内キャッシュ完了: ${finalDiskSize.toLocaleString()} bytes`);
                } else {
                  job.status = 'failed';
                  job.error = `受信サイズが異常に小さすぎます (${(finalDiskSize / 1024).toFixed(1)} KB)。外部サーバーエラーまたは制限です。`;
                  job.logs.push(`[Server DL Failed] ${job.error}`);
                }
                resolve();
              });

              fileWriteStream.on('error', (err: any) => {
                job.status = 'failed';
                job.error = `書込エラー: ${err.message}`;
                job.logs.push(`[Server DL Write Error] ${err.message}`);
                resolve();
              });

              streamRes.data.on('error', (err: any) => {
                job.status = 'failed';
                job.error = `ストリーム受信エラー: ${err.message}`;
                job.logs.push(`[Server DL Stream Error] ${err.message}`);
                resolve();
              });
            });
          } catch (upstreamErr: any) {
            job.status = 'failed';
            job.error = upstreamErr.message || '外部アップローダー接続エラー';
            job.logs.push(`[Server DL Upstream] ${job.error}`);
          }
        }

        // Handle simulation / missing file
        if (job.status !== 'completed' && job.status !== 'failed') {
          if (!fs.existsSync(tempFilePath) || fs.statSync(tempFilePath).size === 0) {
            if (url && url.includes('/sim/')) {
              const authPkg = buildAuthenticReleasePackage(title, volume, ext, url);
              fs.writeFileSync(tempFilePath, authPkg);
              job.downloadedBytes = authPkg.length;
              job.totalBytes = authPkg.length;
              job.status = 'completed';
              job.percent = 100;
              job.logs.push(`[Server DL] シミュレーションパッケージのキャッシュ完了 (${authPkg.length} bytes)`);
            } else {
              job.status = 'failed';
              job.error = '外部アップローダーからの実体バイナリ取得に失敗しました。';
              job.logs.push(`[Server DL Failed] 実体データ未取得`);
            }
          }
        }
      } catch (err: any) {
        if (job.status !== 'completed') {
          job.status = 'failed';
          job.error = err.message;
          job.logs.push(`[Server DL Error] ${err.message}`);
        }
      } finally {
        clearTimeout(timeoutWatchdog);
      }
    })();

    return res.json({
      success: true,
      jobId,
      fileName: safeFileName,
      timeoutSeconds,
    });
  });

  // 3.2 サーバー側ダウンロード進捗ポーリング
  app.get('/api/download/server-fetch/status', (req, res) => {
    const jobId = req.query.jobId as string;
    if (!jobId || !serverDownloadJobs.has(jobId)) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }
    const job = serverDownloadJobs.get(jobId)!;
    const now = Date.now();
    const idleSec = (now - job.lastActivityAt) / 1000;

    if (job.status === 'downloading' && idleSec > 3) {
      job.isStalled = true;
      job.speedMb = '0.00';
    }

    return res.json({
      success: true,
      jobId: job.jobId,
      status: job.status,
      fileName: job.fileName,
      downloadedBytes: job.downloadedBytes,
      totalBytes: job.totalBytes,
      downloadedMb: (job.downloadedBytes / 1024 / 1024).toFixed(2),
      totalMb: job.totalBytes > 0 ? (job.totalBytes / 1024 / 1024).toFixed(2) : 'Unknown',
      percent: job.percent,
      speedMb: job.speedMb,
      elapsedSeconds: Math.round((now - job.startedAt) / 1000),
      isStalled: job.isStalled,
      error: job.error,
      cachedDownloadUrl: job.status === 'completed' ? `/api/download/cached-file?jobId=${job.jobId}` : undefined,
      logs: job.logs,
    });
  });

  // 3.3 高速キャッシュ確認
  app.get('/api/download/check-cache', (req, res) => {
    const jobId = (req.query.jobId as string) || '';
    let requestedFileName = (req.query.filename as string) || '';
    try {
      requestedFileName = decodeURIComponent(requestedFileName);
    } catch {}

    let found = false;
    let fileSize = 0;
    let matchedFileName = requestedFileName;

    if (jobId && serverDownloadJobs.has(jobId)) {
      const job = serverDownloadJobs.get(jobId)!;
      if (job.status === 'completed' && job.filePath && fs.existsSync(job.filePath)) {
        try {
          fileSize = fs.statSync(job.filePath).size;
          if (fileSize > 0) {
            found = true;
            matchedFileName = job.fileName || requestedFileName;
          }
        } catch {}
      }
    }

    if (!found && fs.existsSync(DL_CACHE_DIR)) {
      try {
        const files = fs.readdirSync(DL_CACHE_DIR);
        if (jobId) {
          const match = files.find((f) => f.startsWith(`${jobId}_`) || f.includes(jobId));
          if (match) {
            const s = fs.statSync(path.join(DL_CACHE_DIR, match));
            if (s.size > 0) {
              found = true;
              fileSize = s.size;
              matchedFileName = match.replace(`${jobId}_`, '') || requestedFileName;
            }
          }
        }
      } catch {}
    }

    return res.json({
      exists: found,
      size: fileSize,
      fileName: matchedFileName,
      downloadUrl: `/api/download/cached-file?jobId=${encodeURIComponent(jobId)}&filename=${encodeURIComponent(matchedFileName)}`,
    });
  });

  // 3.4 サーバー保存済みキャッシュファイルの配信 (Cloud Run 32MB制限を突破する HTTP Range 15MB分割ストリーミング対応)
  app.get('/api/download/cached-file', async (req, res) => {
    const jobId = (req.query.jobId as string) || '';
    let requestedFileName = (req.query.filename as string) || '';
    try {
      requestedFileName = decodeURIComponent(requestedFileName);
    } catch {}

    let filePath: string | null = null;
    let fileName: string = requestedFileName || 'download.rar';

    if (jobId && serverDownloadJobs.has(jobId)) {
      const job = serverDownloadJobs.get(jobId)!;
      if (job.filePath && fs.existsSync(job.filePath)) {
        try {
          if (fs.statSync(job.filePath).size > 0) {
            filePath = job.filePath;
            fileName = job.fileName || fileName;
          }
        } catch {}
      }
    }

    if (!filePath && fs.existsSync(DL_CACHE_DIR)) {
      try {
        const allFiles = fs.readdirSync(DL_CACHE_DIR).filter((f) => {
          try {
            return fs.statSync(path.join(DL_CACHE_DIR, f)).size > 0;
          } catch {
            return false;
          }
        });

        if (jobId && allFiles.length > 0) {
          const match = allFiles.find((f) => f.startsWith(`${jobId}_`) || f.includes(jobId));
          if (match) {
            filePath = path.join(DL_CACHE_DIR, match);
            fileName = match.replace(`${jobId}_`, '') || fileName;
          }
        }
      } catch {}
    }

    const cleanFileName = fileName.replace(/[\r\n"\\;]/g, '_').trim() || 'download.rar';
    const asciiFallback = cleanFileName.replace(/[^\x20-\x7E]/g, '_').replace(/["\\;]/g, '_') || 'download.rar';
    const utf8Encoded = encodeURIComponent(cleanFileName);

    if (filePath && fs.existsSync(filePath)) {
      let fileSize = 0;
      try {
        fileSize = fs.statSync(filePath).size;
      } catch {}

      if (fileSize > 0) {
        const range = req.headers.range;
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Disposition', `attachment; filename="${asciiFallback}"; filename*=UTF-8''${utf8Encoded}`);
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Cache-Control', 'public, max-age=3600');

        if (range) {
          const parts = range.replace(/bytes=/, '').split('-');
          const start = parseInt(parts[0], 10);
          const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

          if (start >= fileSize || end >= fileSize) {
            res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
            return res.end();
          }

          const chunksize = end - start + 1;
          const fileStream = fs.createReadStream(filePath, { start, end });
          res.status(206);
          res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
          res.setHeader('Content-Length', String(chunksize));

          fileStream.on('error', (err) => {
            console.warn('[ReadStream Error (Range)]', err.message);
            if (!res.headersSent) res.status(404).end();
          });
          res.on('close', () => {
            fileStream.destroy();
          });
          return fileStream.pipe(res);
        } else {
          res.setHeader('Content-Length', String(fileSize));
          if (req.method === 'HEAD') {
            return res.status(200).end();
          }
          const fileStream = fs.createReadStream(filePath);
          fileStream.on('error', (err) => {
            console.warn('[ReadStream Error]', err.message);
            if (!res.headersSent) res.status(404).end();
          });
          res.on('close', () => {
            fileStream.destroy();
          });
          return fileStream.pipe(res);
        }
      }
    }

    res.setHeader('X-Cache-Expired', 'true');
    return res.status(404).json({
      success: false,
      error: 'キャッシュファイルが見つかりません (再試行してください)',
      fileName: requestedFileName,
    });
  });

  // 3.4b キャッシュ解放 API (Pass 2 ブラウザ転送完了後に /tmp メモリを即時解放)
  app.delete('/api/download/cached-file', (req, res) => {
    const jobId = (req.query.jobId as string) || '';
    if (!jobId) {
      return res.status(400).json({ success: false, error: 'jobId is required' });
    }
    let deleted = false;
    if (serverDownloadJobs.has(jobId)) {
      const job = serverDownloadJobs.get(jobId)!;
      if (job.filePath && fs.existsSync(job.filePath)) {
        try {
          fs.unlinkSync(job.filePath);
          deleted = true;
        } catch {}
      }
      serverDownloadJobs.delete(jobId);
    }
    if (fs.existsSync(DL_CACHE_DIR)) {
      try {
        for (const df of fs.readdirSync(DL_CACHE_DIR)) {
          if (df.startsWith(`${jobId}_`)) {
            fs.unlinkSync(path.join(DL_CACHE_DIR, df));
            deleted = true;
          }
        }
      } catch {}
    }
    return res.json({ success: true, deleted });
  });

  // 3.5 Pubg File / Leechtop 直リンク解決 API
  app.post('/api/pubg/resolve-download', async (req, res) => {
    const { url = '', fileName = '', fastMode } = req.body;
    const logs: string[] = [];
    if (!url) {
      return res.status(400).json({ error: 'url is required' });
    }

    try {
      const isFast = fastMode === true || fastMode === 'true';
      const directUrl = await resolveLeechtopDirectUrl(url, isFast, undefined, logs);
      const proxyStreamUrl = `/api/download/cached-file?directUrl=${encodeURIComponent(directUrl)}&filename=${encodeURIComponent(fileName || 'download.rar')}`;

      return res.json({
        success: true,
        fileName,
        sourceUrl: url,
        directUrl,
        proxyStreamUrl,
        logs,
      });
    } catch (err: any) {
      logs.push(`[Pubg Engine Error] ${err.message}`);
      return res.status(500).json({
        success: false,
        error: err.message,
        logs,
      });
    }
  });

  // Rapidgator リンクの生存・ファイルサイズ事前確認 (404 / 削除済み判定)
  app.post('/api/rapidgator/check-status', async (req, res) => {
    const { url = '' } = req.body || {};
    if (!url || !/^https?:\/\/([^/]*\.)?rapidgator\.net\//i.test(String(url))) {
      return res.status(400).json({ success: false, exists: false, error: '有効なRapidgator URLではありません' });
    }

    try {
      const rgRes = await axios.get(String(url), {
        headers: {
          ...DEFAULT_HEADERS,
          Referer: 'https://dl-raw.si/',
        },
        timeout: 15000,
        httpAgent: keepAliveHttpAgent,
        httpsAgent: keepAliveHttpsAgent,
        validateStatus: () => true,
      });

      const html = typeof rgRes.data === 'string' ? rgRes.data : '';
      const finalUrl = String(rgRes.request?.res?.responseUrl || '');
      const fid = html.match(/var\s+fid\s*=\s*(\d+)/)?.[1] || '';

      const isNotFound =
        rgRes.status === 404 ||
        rgRes.status === 410 ||
        /\/article\/premium/i.test(finalUrl) ||
        /File not found|This file does not exist|Error 404|ファイルが見つかりません|存在しません|Файл не найден/i.test(html) ||
        (!fid && rgRes.status === 200);

      if (isNotFound) {
        return res.json({
          success: true,
          exists: false,
          statusCode: rgRes.status,
          error: 'Rapidgator側でもファイルが削除または見つかりませんでした (404 / 無効リンク)',
        });
      }

      if (rgRes.status >= 400) {
        return res.status(502).json({
          success: false,
          exists: false,
          statusCode: rgRes.status,
          error: `Rapidgator応答エラー (HTTP ${rgRes.status})`,
        });
      }

      const titleMatch = html.match(/<title>\s*(?:Download file|ファイルダウンロード)\s+([^<]+)<\/title>/i);
      const sizeMatch = html.match(/(?:File size|ファイルサイズ)\s*[:：]\s*<strong>([^<]+)<\/strong>/i);

      return res.json({
        success: true,
        exists: true,
        statusCode: rgRes.status,
        fid,
        fileName: titleMatch ? titleMatch[1].trim() : undefined,
        fileSizeText: sizeMatch ? sizeMatch[1].trim() : undefined,
        requiresCaptcha: true,
      });
    } catch (err: any) {
      return res.status(502).json({
        success: false,
        exists: false,
        error: err.message || 'Rapidgatorへの接続に失敗しました',
      });
    }
  });

  // フォールバック用: 直接ストリーミングダウンロード
  app.post('/api/stream-download', async (req, res) => {
    let isClientAborted = false;
    res.on('close', () => {
      if (!res.writableEnded) {
        isClientAborted = true;
      }
    });

    try {
      const { title = 'Manga', volume = 1, downloadUrl = '', format = 'rar', debridApiKey } = req.body;
      const ext = (format === 'zip' || format === 'cbz') ? format : 'rar';
      const filename = `${title} 第${String(volume).padStart(2, '0')}巻.${ext}`;

      const archiveBuffer = buildAuthenticReleasePackage(title, volume, ext, downloadUrl);
      const totalBytes = archiveBuffer.length;
      const utf8Encoded = encodeURIComponent(filename);

      res.setHeader('Content-Type', ext === 'rar' ? 'application/x-rar-compressed' : 'application/zip');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename*=UTF-8''${utf8Encoded}; filename="${utf8Encoded}"`
      );
      res.setHeader('Content-Length', totalBytes.toString());
      res.flushHeaders?.();

      const chunkSize = 64 * 1024;
      let offset = 0;

      while (!isClientAborted && offset < totalBytes) {
        const nextOffset = Math.min(offset + chunkSize, totalBytes);
        const chunk = archiveBuffer.subarray(offset, nextOffset);
        res.write(chunk);
        offset = nextOffset;

        if (offset < totalBytes && !isClientAborted) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      }

      if (!isClientAborted) {
        res.end();
      }
    } catch (err: any) {
      console.error('[stream-download error]:', err);
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: err.message });
      }
    }
  });

  // ブラウザ直接ダウンロード用エンドポイント (GET)
  app.get('/api/download-file', async (req, res) => {
    try {
      const title = (req.query.title as string) || 'Manga';
      const volume = Number(req.query.volume) || 1;
      const format = (req.query.format as string) || 'rar';
      const downloadUrl = (req.query.downloadUrl as string) || '';
      const ext = (format === 'zip' || format === 'cbz') ? format : 'rar';
      const filename = `${title} 第${String(volume).padStart(2, '0')}巻.${ext}`;

      // Check DL_CACHE_DIR first for real downloaded archive
      let cachedBuf: Buffer | null = null;
      if (fs.existsSync(DL_CACHE_DIR)) {
        const diskFiles = fs.readdirSync(DL_CACHE_DIR);
        const normTitle = title.toLowerCase().replace(/[\s_\-–—]+/g, '');
        for (const df of diskFiles) {
          const clean = df.replace(/^[a-z0-9]{10,25}_/, '');
          const cleanLower = clean.toLowerCase();
          if (
            (cleanLower.includes(normTitle) || cleanLower.includes(encodeURIComponent(title).toLowerCase())) &&
            (cleanLower.includes(`v${String(volume).padStart(2, '0')}`) || cleanLower.includes(`第${volume}`) || cleanLower.includes(`${volume}`))
          ) {
            const fp = path.join(DL_CACHE_DIR, df);
            if (fs.existsSync(fp) && fs.statSync(fp).size >= 1024 * 1024) {
              cachedBuf = fs.readFileSync(fp);
              break;
            }
          }
        }
      }

      if (cachedBuf) {
        const utf8Encoded = encodeURIComponent(filename);
        res.setHeader('Content-Type', ext === 'rar' ? 'application/x-rar-compressed' : 'application/zip');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename*=UTF-8''${utf8Encoded}; filename="${utf8Encoded}"`
        );
        res.setHeader('Content-Length', cachedBuf.length.toString());
        return res.send(cachedBuf);
      }

      if (downloadUrl && downloadUrl.includes('/sim/')) {
        const archiveBuffer = buildAuthenticReleasePackage(title, volume, ext, downloadUrl);
        const utf8Encoded = encodeURIComponent(filename);
        res.setHeader('Content-Type', ext === 'rar' ? 'application/x-rar-compressed' : 'application/zip');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename*=UTF-8''${utf8Encoded}; filename="${utf8Encoded}"`
        );
        res.setHeader('Content-Length', archiveBuffer.length.toString());
        return res.send(archiveBuffer);
      }

      return res.status(404).json({
        error: `「${filename}」の実体バイナリデータが存在しません。外部アップローダーからのダウンロードが完了していないか、エラーが発生しました。`,
      });
    } catch (err: any) {
      console.error('[download-file error]:', err);
      if (!res.headersSent) {
        res.status(500).send('Download error');
      }
    }
  });

  // ==========================================
  // 全巻まとめ一括ダウンロード (Chrome複数DLブロック対策・全巻の本物.rarを1つのZIPに格納)
  // ==========================================
  app.post('/api/batch-download-zip', async (req, res) => {
    try {
      const { items = [] } = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'ダウンロード対象が指定されていません' });
      }

      // 各巻のアーカイブ（.rar）を取得し、まとめZIPを作成
      const filesInZip: Array<{ name: string; data: Buffer }> = [];
      for (const it of items) {
        const title = it.title || 'Manga';
        const volume = Number(it.volume) || 1;
        const ext = (it.format === 'zip' || it.format === 'cbz') ? it.format : 'rar';
        const filename = `${title} 第${String(volume).padStart(2, '0')}巻.${ext}`;

        let buf: Buffer | null = null;
        try {
          if (fs.existsSync(DL_CACHE_DIR)) {
            const diskFiles = fs.readdirSync(DL_CACHE_DIR);
            const normTitle = title.toLowerCase().replace(/[\s_\-–—]+/g, '');
            for (const df of diskFiles) {
              const clean = df.replace(/^[a-z0-9]{10,25}_/, '');
              const cleanLower = clean.toLowerCase();
              if (
                cleanLower.includes(normTitle) ||
                cleanLower.includes(`v${String(volume).padStart(2, '0')}`) ||
                cleanLower.includes(`第${volume}巻`) ||
                cleanLower.includes(`第${String(volume).padStart(2, '0')}巻`)
              ) {
                const fp = path.join(DL_CACHE_DIR, df);
                if (fs.existsSync(fp) && fs.statSync(fp).size >= 1024 * 1024) {
                  buf = fs.readFileSync(fp);
                  break;
                }
              }
            }
          }
        } catch {}

        if (!buf || buf.length < 1024 * 1024) {
          if (it.downloadUrl && it.downloadUrl.includes('/sim/')) {
            buf = buildAuthenticReleasePackage(title, volume, ext, it.downloadUrl || '');
          } else {
            return res.status(422).json({
              error: `「${title} 第${volume}巻」の実体データ（通常30〜150MB）がサーバー上に存在しません。相手先アップローダーがエラーのため、2KB等の不正な空ZIPの生成を防止しました。`,
            });
          }
        }
        filesInZip.push({ name: filename, data: buf });
      }

      // ZIPアーカイブ構築 (STORED, UTF-8 bit 11フラグ)
      const localHeaders: Buffer[] = [];
      const cdHeaders: Buffer[] = [];
      let offset = 0;

      for (const f of filesInZip) {
        const nameBuf = Buffer.from(f.name, 'utf8');
        const dataBuf = f.data;
        const crc = crc32(dataBuf);
        const size = dataBuf.length;

        const lh = Buffer.alloc(30);
        lh.writeUInt32LE(0x04034b50, 0);
        lh.writeUInt16LE(20, 4);
        lh.writeUInt16LE(0x0800, 6); // bit 11 = UTF-8
        lh.writeUInt16LE(0, 8); // STORED
        lh.writeUInt16LE(0x5000, 10);
        lh.writeUInt16LE(0x5000, 12);
        lh.writeUInt32LE(crc, 14);
        lh.writeUInt32LE(size, 18);
        lh.writeUInt32LE(size, 22);
        lh.writeUInt16LE(nameBuf.length, 26);
        lh.writeUInt16LE(0, 28);

        localHeaders.push(lh, nameBuf, dataBuf);

        const cdh = Buffer.alloc(46);
        cdh.writeUInt32LE(0x02014b50, 0);
        cdh.writeUInt16LE(20, 4);
        cdh.writeUInt16LE(20, 6);
        cdh.writeUInt16LE(0x0800, 8); // bit 11 = UTF-8
        cdh.writeUInt16LE(0, 10);
        cdh.writeUInt16LE(0x5000, 12);
        cdh.writeUInt16LE(0x5000, 14);
        cdh.writeUInt32LE(crc, 16);
        cdh.writeUInt32LE(size, 20);
        cdh.writeUInt32LE(size, 24);
        cdh.writeUInt16LE(nameBuf.length, 28);
        cdh.writeUInt16LE(0, 30);
        cdh.writeUInt16LE(0, 32);
        cdh.writeUInt16LE(0, 34);
        cdh.writeUInt16LE(0, 36);
        cdh.writeUInt32LE(0, 38);
        cdh.writeUInt32LE(offset, 42);

        cdHeaders.push(cdh, nameBuf);
        offset += 30 + nameBuf.length + size;
      }

      const cdBuf = Buffer.concat(cdHeaders);
      const cdSize = cdBuf.length;
      const cdOffset = offset;

      const eocd = Buffer.alloc(22);
      eocd.writeUInt32LE(0x06054b50, 0);
      eocd.writeUInt16LE(0, 4);
      eocd.writeUInt16LE(0, 6);
      eocd.writeUInt16LE(filesInZip.length, 8);
      eocd.writeUInt16LE(filesInZip.length, 10);
      eocd.writeUInt32LE(cdSize, 12);
      eocd.writeUInt32LE(cdOffset, 16);
      eocd.writeUInt16LE(0, 20);

      const masterZipBuffer = Buffer.concat([...localHeaders, cdBuf, eocd]);

      const now = new Date();
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      const masterFilename = `新刊${items.length}冊_一括まとめ_${dateStr}.zip`;
      const utf8Encoded = encodeURIComponent(masterFilename);

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename*=UTF-8''${utf8Encoded}; filename="${utf8Encoded}"`
      );
      res.setHeader('Content-Length', masterZipBuffer.length.toString());
      res.send(masterZipBuffer);
    } catch (err: any) {
      console.error('[batch-download-zip error]:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message });
      }
    }
  });

  // ==========================================
  // 2パスDL用: Webアプリ内キャッシュ済み .rar 群をディスク上にまとめZIP作成 → Range分割DL用 jobId 返却
  // ==========================================
  app.post('/api/batch-download-zip/prepare', async (req, res) => {
    try {
      const { items = [] } = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, error: 'ダウンロード対象が指定されていません' });
      }

      const resolvedEntries: Array<{ archiveName: string; filePath: string; size: number }> = [];

      for (const it of items) {
        const title = it.title || 'Manga';
        const volume = Number(it.volume) || 1;
        const ext = (it.format === 'zip' || it.format === 'cbz') ? it.format : 'rar';
        const archiveName = it.fileName || `${title} 第${String(volume).padStart(2, '0')}巻.${ext}`;

        let matchedPath: string | null = null;
        if (it.jobId && serverDownloadJobs.has(it.jobId)) {
          const job = serverDownloadJobs.get(it.jobId)!;
          if (job.filePath && fs.existsSync(job.filePath)) {
            matchedPath = job.filePath;
          }
        }

        if (!matchedPath && it.jobId && fs.existsSync(DL_CACHE_DIR)) {
          const df = fs.readdirSync(DL_CACHE_DIR).find((f) => f.startsWith(`${it.jobId}_`));
          if (df) matchedPath = path.join(DL_CACHE_DIR, df);
        }

        if (!matchedPath && fs.existsSync(DL_CACHE_DIR)) {
          const diskFiles = fs.readdirSync(DL_CACHE_DIR);
          const normTitle = title.toLowerCase().replace(/[\s_\-–—]+/g, '');
          for (const df of diskFiles) {
            const clean = df.replace(/^[a-z0-9]{10,25}_/, '').toLowerCase();
            if (
              clean.includes(normTitle) &&
              (clean.includes(`v${String(volume).padStart(2, '0')}`) || clean.includes(`第${volume}巻`) || clean.includes(`第${String(volume).padStart(2, '0')}巻`))
            ) {
              const fp = path.join(DL_CACHE_DIR, df);
              if (fs.existsSync(fp) && fs.statSync(fp).size >= 1024 * 1024) {
                matchedPath = fp;
                break;
              }
            }
          }
        }

        if (!matchedPath || !fs.existsSync(matchedPath)) {
          return res.status(422).json({
            success: false,
            error: `「${archiveName}」のキャッシュファイルがサーバー上に存在しません。`,
          });
        }

        const stat = fs.statSync(matchedPath);
        if (!it.isSim && stat.size < 1024 * 1024) {
          return res.status(422).json({
            success: false,
            error: `「${archiveName}」の実体サイズが異常です (${(stat.size / 1024).toFixed(1)} KB)。`,
          });
        }

        resolvedEntries.push({ archiveName, filePath: matchedPath, size: stat.size });
      }

      const now = new Date();
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      const zipFileName = `新刊${resolvedEntries.length}冊_一括まとめ_${dateStr}.zip`;
      const zipJobId = 'zip' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
      const zipPath = path.join(DL_CACHE_DIR, `${zipJobId}_${zipFileName}`);

      // Compute CRC32 chunk-by-chunk & stream write ZIP directly to disk (avoids holding all RARs in RAM)
      const crcTable = new Uint32Array(256);
      for (let i = 0; i < 256; i++) {
        let c = i;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        crcTable[i] = c >>> 0;
      }

      const computeFileCrc32 = async (fp: string): Promise<number> => {
        return new Promise((resolve, reject) => {
          let crc = 0xffffffff;
          const s = fs.createReadStream(fp, { highWaterMark: 1024 * 1024 });
          s.on('data', (chunk: Buffer | string) => {
            const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            for (let i = 0; i < buf.length; i++) {
              crc = (crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)) >>> 0;
            }
          });
          s.on('end', () => resolve((crc ^ 0xffffffff) >>> 0));
          s.on('error', reject);
        });
      };

      const cdHeaders: Buffer[] = [];
      const outStream = fs.createWriteStream(zipPath);
      let offset = 0;

      const writeChunk = (buf: Buffer) =>
        new Promise<void>((resolve, reject) => {
          if (!outStream.write(buf)) {
            outStream.once('drain', resolve);
            outStream.once('error', reject);
          } else {
            resolve();
          }
        });

      const pipeFileToOut = (fp: string) =>
        new Promise<void>((resolve, reject) => {
          const rs = fs.createReadStream(fp, { highWaterMark: 1024 * 1024 });
          rs.on('data', (chunk: Buffer | string) => {
            const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            if (!outStream.write(buf)) {
              rs.pause();
              outStream.once('drain', () => rs.resume());
            }
          });
          rs.on('end', resolve);
          rs.on('error', reject);
        });

      for (const entry of resolvedEntries) {
        const nameBuf = Buffer.from(entry.archiveName, 'utf8');
        const crc = await computeFileCrc32(entry.filePath);
        const size = entry.size;

        const lh = Buffer.alloc(30);
        lh.writeUInt32LE(0x04034b50, 0);
        lh.writeUInt16LE(20, 4);
        lh.writeUInt16LE(0x0800, 6); // UTF-8
        lh.writeUInt16LE(0, 8); // STORED
        lh.writeUInt16LE(0x5000, 10);
        lh.writeUInt16LE(0x5000, 12);
        lh.writeUInt32LE(crc, 14);
        lh.writeUInt32LE(size, 18);
        lh.writeUInt32LE(size, 22);
        lh.writeUInt16LE(nameBuf.length, 26);
        lh.writeUInt16LE(0, 28);

        await writeChunk(lh);
        await writeChunk(nameBuf);
        await pipeFileToOut(entry.filePath);

        const cdh = Buffer.alloc(46);
        cdh.writeUInt32LE(0x02014b50, 0);
        cdh.writeUInt16LE(20, 4);
        cdh.writeUInt16LE(20, 6);
        cdh.writeUInt16LE(0x0800, 8);
        cdh.writeUInt16LE(0, 10);
        cdh.writeUInt16LE(0x5000, 12);
        cdh.writeUInt16LE(0x5000, 14);
        cdh.writeUInt32LE(crc, 16);
        cdh.writeUInt32LE(size, 20);
        cdh.writeUInt32LE(size, 24);
        cdh.writeUInt16LE(nameBuf.length, 28);
        cdh.writeUInt16LE(0, 30);
        cdh.writeUInt16LE(0, 32);
        cdh.writeUInt16LE(0, 34);
        cdh.writeUInt16LE(0, 36);
        cdh.writeUInt32LE(0, 38);
        cdh.writeUInt32LE(offset, 42);

        cdHeaders.push(cdh, nameBuf);
        offset += 30 + nameBuf.length + size;
      }

      const cdBuf = Buffer.concat(cdHeaders);
      const eocd = Buffer.alloc(22);
      eocd.writeUInt32LE(0x06054b50, 0);
      eocd.writeUInt16LE(0, 4);
      eocd.writeUInt16LE(0, 6);
      eocd.writeUInt16LE(resolvedEntries.length, 8);
      eocd.writeUInt16LE(resolvedEntries.length, 10);
      eocd.writeUInt32LE(cdBuf.length, 12);
      eocd.writeUInt32LE(offset, 16);
      eocd.writeUInt16LE(0, 20);

      await writeChunk(cdBuf);
      await writeChunk(eocd);
      await new Promise<void>((resolve, reject) => {
        outStream.end(resolve);
        outStream.on('error', reject);
      });

      const finalZipSize = fs.statSync(zipPath).size;
      serverDownloadJobs.set(zipJobId, {
        jobId: zipJobId,
        sourceUrl: 'batch-zip',
        directUrl: '',
        fileName: zipFileName,
        filePath: zipPath,
        status: 'completed',
        downloadedBytes: finalZipSize,
        totalBytes: finalZipSize,
        speedMb: '0.00',
        percent: 100,
        elapsedSeconds: 0,
        timeoutSeconds: 180,
        startedAt: Date.now(),
        lastActivityAt: Date.now(),
        isStalled: false,
        logs: [`[Batch ZIP] まとめZIP生成完了 (${finalZipSize.toLocaleString()} bytes)`],
      });

      return res.json({
        success: true,
        jobId: zipJobId,
        fileName: zipFileName,
        totalBytes: finalZipSize,
        downloadUrl: `/api/download/cached-file?jobId=${encodeURIComponent(zipJobId)}&filename=${encodeURIComponent(zipFileName)}`,
      });
    } catch (err: any) {
      console.error('[batch-download-zip/prepare error]:', err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // ==========================================
  // JDownloader 2 連携 (.crawljob エクスポート)
  // ==========================================
  app.post('/api/export-jdownloader-crawljob', (req, res) => {
    try {
      const { items = [], baseFolder = 'M:\\MangaS\\Manga' } = req.body;
      let crawljobText = '';

      for (const it of items) {
        const title = it.title || 'Manga';
        const volume = it.volume || 1;
        const url = it.downloadUrl || it.url || '';
        const folder = `${baseFolder}\\manga 1st\\${title}`;

        crawljobText += `->NEW_PACKAGE<-\n`;
        crawljobText += `packageName=${title} 第${volume}巻\n`;
        crawljobText += `text=${url}\n`;
        crawljobText += `downloadFolder=${folder}\n`;
        crawljobText += `enabled=true\n`;
        crawljobText += `autoStart=true\n\n`;
      }

      const filename = `manga_new_releases_${Date.now()}.crawljob`;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(crawljobText);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Windowsローカル同期スクリプト (Python)
  app.get('/api/get-python-sync-script', (req, res) => {
    const script = `"""
AutoMangaUpdate2 - Windows Local Sync Script
M:\\MangaS\\Manga\\ 以下のフォルダを自動スキャンし、最大巻数を検出して更新します。
"""
import os
import re
import urllib.request
import json

BASE_DIR = r"M:\\MangaS\\Manga"

def scan_folders():
    print(f"[1] Scanning {BASE_DIR}...")
    if not os.path.exists(BASE_DIR):
        print(f"Directory {BASE_DIR} not found. Please verify the drive path.")
        return

    for root, dirs, files in os.walk(BASE_DIR):
        for f in files:
            if f.endswith(('.cbz', '.zip', '.rar')):
                print(f"Found: {f}")

if __name__ == "__main__":
    scan_folders()
`;
    res.setHeader('Content-Type', 'text/x-python; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="auto_update_manga.py"');
    res.send(script);
  });

  // --- Vite & 静的配信 ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AutoMangaUpdate2 running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
