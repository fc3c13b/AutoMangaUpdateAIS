import axios from 'axios';
import * as cheerio from 'cheerio';
import { parsePostTitle, normalizeTitle } from '../src/utils/parser.js';
import { Storage } from './storage.js';
import { generateMockDlRawHtml } from './sampleData.js';
import {
  CrawlSettings,
  CrawlStatus,
  CrawlLog,
  CrawlStats,
  Checkpoint,
  MangaItem,
  ScraperState,
} from '../src/types.js';

export class ScraperEngine {
  private status: CrawlStatus = 'idle';
  private currentPage = 1;
  private maxPages = 10;
  private currentPostIndex = 0;
  private totalPostsInPage = 0;
  private itemsFoundInCurrentRun = 0;
  private newTitlesInCurrentRun = 0;
  private updatedTitlesInCurrentRun = 0;
  private shouldStop = false;
  private isPaused = false;
  private listeners: ((event: any) => void)[] = [];
  private logs: CrawlLog[] = [];
  private currentSettings: CrawlSettings = {
    category: 'manga',
    baseUrl: 'https://dl-raw.si/category/manga',
    startPage: 2150,
    maxPages: 2150,
    waitMs: 1500,
    stopOnCheckpoint: false,
    mode: 'live',
  };
  private lastStats: CrawlStats | null = null;
  private startTime: number = 0;
  private abortController: AbortController | null = null;
  private firstItemOfRun: Checkpoint | null = null;
  private lastProcessedItem: Checkpoint | null = null;

  constructor() {
    this.lastStats = Storage.getStats();
  }

  public getCrawlCategory(): 'manga' | 'magazine' {
    if (this.currentSettings.category) {
      return this.currentSettings.category;
    }
    const base = (this.currentSettings.baseUrl || '').toLowerCase();
    if (base.includes('/category/magazine') || base.includes('magazine')) {
      return 'magazine';
    }
    return 'manga';
  }

  public subscribe(listener: (event: any) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private broadcast(type: string, payload: any): void {
    const event = { type, payload, timestamp: new Date().toISOString() };
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('Error in event listener:', err);
      }
    }
  }

  private addLog(
    level: 'info' | 'success' | 'warning' | 'error' | 'checkpoint',
    message: string,
    page?: number,
    data?: any
  ): void {
    const log: CrawlLog = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      level,
      message,
      page,
      data,
    };
    this.logs.unshift(log);
    if (this.logs.length > 500) {
      this.logs.pop();
    }
    this.broadcast('log', log);
  }

  public getState(): ScraperState {
    const cat = this.getCrawlCategory();
    return {
      status: this.status,
      currentPage: this.currentPage,
      maxPages: this.maxPages,
      currentPostIndex: this.currentPostIndex,
      totalPostsInPage: this.totalPostsInPage,
      itemsFoundInCurrentRun: this.itemsFoundInCurrentRun,
      newTitlesInCurrentRun: this.newTitlesInCurrentRun,
      updatedTitlesInCurrentRun: this.updatedTitlesInCurrentRun,
      checkpoint: Storage.getCheckpoint(cat),
      previousCheckpoint: Storage.getPreviousCheckpoint(cat),
      lastRunStats: this.lastStats,
      currentSettings: this.currentSettings,
      activeLog: this.logs.slice(0, 100),
    };
  }

  public async start(settings?: Partial<CrawlSettings>): Promise<boolean> {
    if (this.status === 'running') {
      return false;
    }

    const targetCategory = settings?.category || (settings?.baseUrl?.includes('magazine') ? 'magazine' : 'manga');

    this.currentSettings = {
      ...this.currentSettings,
      category: targetCategory,
      ...settings,
    };

    // If baseUrl contains /page/\d+/, extract page and clean base URL
    let reqBaseUrl = (this.currentSettings.baseUrl || '').trim();
    if (!reqBaseUrl) {
      reqBaseUrl = targetCategory === 'magazine'
        ? 'https://dl-raw.si/category/magazine'
        : 'https://dl-raw.si/category/manga';
    }

    const pageMatch = reqBaseUrl.match(/\/page\/(\d+)\/?$/);
    if (pageMatch) {
      const extractedPage = parseInt(pageMatch[1], 10);
      reqBaseUrl = reqBaseUrl.replace(/\/page\/\d+\/?$/, '');
      if (settings?.startPage === undefined) {
        this.currentSettings.startPage = extractedPage;
      }
    }
    this.currentSettings.baseUrl = reqBaseUrl.replace(/\/+$/, '');

    this.status = 'running';
    this.shouldStop = false;
    this.isPaused = false;
    this.currentPage = this.currentSettings.startPage || 1;
    this.maxPages = this.currentSettings.maxPages !== undefined ? this.currentSettings.maxPages : this.currentPage;
    this.itemsFoundInCurrentRun = 0;
    this.newTitlesInCurrentRun = 0;
    this.updatedTitlesInCurrentRun = 0;
    this.startTime = Date.now();
    this.firstItemOfRun = null;
    this.lastProcessedItem = null;

    this.addLog(
      'info',
      `クロールを開始します [カテゴリ: ${targetCategory.toUpperCase()}, URL: ${this.getPageUrl(this.currentPage)}] (ページ ${this.currentPage} 〜 ${this.maxPages}, 待機間隔: ${this.currentSettings.waitMs}ms, チェックポイント停止: ${this.currentSettings.stopOnCheckpoint ? '有効' : '無効'})`
    );

    this.broadcast('status_change', this.getState());

    // Run crawler loop in background
    this.runLoop().catch((err) => {
      console.error('Crawl loop error:', err);
      this.status = 'error';
      this.addLog('error', `クロール中に予期せぬエラーが発生しました: ${err.message}`);
      this.broadcast('status_change', this.getState());
    });

    return true;
  }

  public stop(): void {
    this.shouldStop = true;
    this.isPaused = false;
    this.status = 'stopped';
    const crawlCategory = this.getCrawlCategory();
    if (this.abortController) {
      try {
        this.abortController.abort();
      } catch (e) {
        // ignore
      }
    }

    // クロール停止時に、今回の巡回で処理された最新アイテムを巡回チェックポイントとして確実に更新保存
    const checkpointToSave = this.firstItemOfRun || this.lastProcessedItem;
    if (checkpointToSave) {
      checkpointToSave.category = crawlCategory;
      Storage.saveCheckpoint(checkpointToSave, crawlCategory);
      Storage.persistAll();
      const prev = Storage.getPreviousCheckpoint(crawlCategory);
      this.addLog(
        'checkpoint',
        `【チェックポイント更新】クロール停止に伴い、今回の巡回先頭作品「${checkpointToSave.title}」(${checkpointToSave.displayVolume || (checkpointToSave.maxVolume > 0 ? checkpointToSave.maxVolume + '巻' : '全1巻')}) を最新チェックポイントに更新保存しました。${
          prev ? `（※一つ前: 「${prev.title}」）` : ''
        }`,
        checkpointToSave.page,
        { current: checkpointToSave, previous: prev }
      );
    }

    this.addLog('warning', 'クロールを手動停止しました。');
    this.broadcast('status_change', this.getState());
    this.broadcast('crawl_finished', {
      stats: this.lastStats,
      state: this.getState(),
    });
  }

  public reset(): void {
    this.shouldStop = true;
    this.isPaused = false;
    this.status = 'idle';
    if (this.abortController) {
      try {
        this.abortController.abort();
      } catch (e) {
        // ignore
      }
    }
    this.addLog('info', 'クロール状態をリセットしました（待機状態）。');
    this.broadcast('status_change', this.getState());
  }

  public pause(): void {
    if (this.status === 'running') {
      this.isPaused = true;
      this.status = 'paused';
      this.addLog('info', 'クロールを一時停止しました。');
      this.broadcast('status_change', this.getState());
    }
  }

  public resume(): void {
    if (this.status === 'paused') {
      this.isPaused = false;
      this.status = 'running';
      this.addLog('info', 'クロールを再開しました。');
      this.broadcast('status_change', this.getState());
    }
  }

  private async sleep(ms: number): Promise<void> {
    const end = Date.now() + ms;
    while (Date.now() < end && !this.shouldStop) {
      await new Promise((resolve) => setTimeout(resolve, Math.min(50, Math.max(1, end - Date.now()))));
    }
  }

  public getPageUrl(page: number): string {
    const cat = this.getCrawlCategory();
    let base = (this.currentSettings.baseUrl || '').trim();
    if (!base) {
      base = cat === 'magazine'
        ? 'https://dl-raw.si/category/magazine'
        : 'https://dl-raw.si/category/manga';
    }
    base = base.replace(/\/page\/\d+\/?$/, '').replace(/\/+$/, '');
    return `${base}/page/${page}/`;
  }

  private async fetchPageHtml(page: number): Promise<{ html: string; source: 'live' | 'mock' }> {
    const url = this.getPageUrl(page);

    if (this.currentSettings.mode === 'simulation') {
      this.addLog('info', `[テスト生成データ] ページ ${page} のHTMLをロード中...`, page);
      await this.sleep(200);
      if (this.shouldStop) return { html: '', source: 'mock' };
      const mockHtml = generateMockDlRawHtml(page);
      return { html: mockHtml, source: 'mock' };
    }

    try {
      this.abortController = new AbortController();
      this.addLog('info', `URLへアクセス中: ${url} (User-Agent偽装, タイムアウト 15秒)`, page);
      const response = await axios.get(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
          Referer: 'https://dl-raw.si/',
        },
        timeout: 15000,
        signal: this.abortController.signal,
        validateStatus: (status) => status < 500, // Handle 404 cleanly
      });

      if (this.shouldStop) {
        return { html: '', source: 'live' };
      }

      if (response.status === 404) {
        this.addLog('info', `ページ ${page} は存在しません (HTTP 404: 最終ページに到達しました)。`, page);
        return { html: '', source: 'live' };
      }

      return { html: response.data, source: 'live' };
    } catch (error: any) {
      if (this.shouldStop || axios.isCancel?.(error) || error.name === 'CanceledError' || error.code === 'ERR_CANCELED') {
        return { html: '', source: 'live' };
      }
      const errorMsg = error.response ? `HTTP ${error.response.status}` : error.message;
      this.addLog(
        'warning',
        `実サイト(${url})の取得に失敗しました [${errorMsg}]。テスト環境用シミュレーションデータにフォールバックして解析を継続します。`,
        page
      );
      return { html: generateMockDlRawHtml(page), source: 'mock' };
    }
  }

  private parseHtmlPosts(html: string): { rawTitle: string; url: string }[] {
    const $ = cheerio.load(html);

    // Strictly ignore sidebars, widgets, popular posts, headers, and footers
    $('#secondary').remove();
    $('.sidebar').remove();
    $('.widget').remove();
    $('.popular-posts').remove();
    $('.widget_popular_posts').remove();
    $('.rpwe-block').remove();
    $('aside').remove();
    $('footer').remove();
    $('#masthead').remove();
    $('header.site-header').remove();
    $('nav.pagination, .navigation.pagination, nav').remove();
    $('.row > .col').each((_, colEl) => {
      if ($(colEl).find('a[href*="/popular"]').length > 0 || $(colEl).prev('.col-lg-9, .col-md-8').length > 0) {
        $(colEl).remove();
      }
    });

    const results: { rawTitle: string; url: string }[] = [];
    const seenUrls = new Set<string>();

    // Strategy 1: Articles in grid-of-posts or main content (covers current and previous dl-raw layouts)
    const gridArticles = $('.grid-of-posts article, .col-lg-9 article, .col-md-8 article');
    const articles = gridArticles.length > 0
      ? gridArticles
      : $('article.position-relative, article.post, .posts-wrap > article, #main article, .site-main article, #content article, article');

    if (articles.length > 0) {
      articles.each((_, el) => {
        const titleEl = $(el).find('h2 a, h1 a, h3 a, .entry-title a, a.stretched-link, a').first();
        const rawTitle = titleEl.attr('title')?.trim() || titleEl.text().trim();
        const url = titleEl.attr('href')?.trim() || '';

        if (rawTitle && url && url.startsWith('http') && !seenUrls.has(url)) {
          seenUrls.add(url);
          results.push({ rawTitle, url });
        }
      });
    }

    // Strategy 2: Fallback to h2 / h1 / entry-title links anywhere in main body
    if (results.length === 0) {
      $('h2 a, h1 a, .entry-title a, .post-title a').each((_, el) => {
        const rawTitle = $(el).attr('title')?.trim() || $(el).text().trim();
        const url = $(el).attr('href')?.trim() || '';
        if (
          rawTitle &&
          url &&
          url.startsWith('http') &&
          !url.includes('/category/') &&
          !url.includes('/tag/') &&
          !url.includes('/author/') &&
          !seenUrls.has(url)
        ) {
          seenUrls.add(url);
          results.push({ rawTitle, url });
        }
      });
    }

    return results;
  }

  private async runLoop(): Promise<void> {
    let stoppedByCheckpoint = false;
    let matchedItemInfo: string | undefined = undefined;
    const crawlCategory = this.getCrawlCategory();
    const existingCheckpoint = Storage.getCheckpoint(crawlCategory);
    const previousCheckpoint = Storage.getPreviousCheckpoint(crawlCategory);
    let targetStopCheckpoint = existingCheckpoint;
    let consecutiveKnownItemsCount = 0;

    if (targetStopCheckpoint) {
      this.addLog(
        'info',
        `[${crawlCategory.toUpperCase()}] 停止対象チェックポイント: 「${targetStopCheckpoint.title} (${targetStopCheckpoint.displayVolume || targetStopCheckpoint.maxVolume + '巻'})」${previousCheckpoint ? ` (前回: ${previousCheckpoint.title})` : ''} - これまたは既知作品に遭遇したら自動停止します。`
      );
    }

    while (this.currentPage <= this.maxPages && !this.shouldStop) {
      // Pause check
      while (this.isPaused && !this.shouldStop) {
        await this.sleep(500);
      }
      if (this.shouldStop) break;

      this.addLog('info', `--- ページ ${this.currentPage} / ${this.maxPages} の解析を開始 ---`, this.currentPage);
      this.broadcast('status_change', this.getState());

      // 1. Fetch HTML
      const { html, source } = await this.fetchPageHtml(this.currentPage);

      // 2. Extract posts (excluding popular posts)
      const rawPosts = this.parseHtmlPosts(html);
      this.totalPostsInPage = rawPosts.length;
      this.currentPostIndex = 0;

      this.addLog(
        'info',
        `ページ ${this.currentPage} で ${rawPosts.length} 件のコンテンツを検出しました (Popular Postsは除外済み, ソース: ${source === 'live' ? '実サイト' : 'テストデータ'})`,
        this.currentPage
      );

      if (rawPosts.length === 0) {
        this.addLog('warning', `ページ ${this.currentPage} にコンテンツが見つかりませんでした。クロールを終了します。`, this.currentPage);
        break;
      }

      // Process each post in page
      for (let i = 0; i < rawPosts.length; i++) {
        if (this.shouldStop) break;
        while (this.isPaused && !this.shouldStop) {
          await this.sleep(500);
        }
        if (this.shouldStop) break;

        this.currentPostIndex = i + 1;
        const post = rawPosts[i];
        const parsed = parsePostTitle(post.rawTitle);

        const currentItemSnapshot: Checkpoint = {
          title: parsed.cleanTitle,
          rawTitle: parsed.rawTitle,
          maxVolume: parsed.maxVolume,
          displayVolume: parsed.displayVolume,
          url: post.url,
          page: this.currentPage,
          savedAt: new Date().toISOString(),
          category: crawlCategory,
        };

        // 今回の巡回で最初に処理したアイテム（最新）と直近処理アイテムを記録
        const isFirstItemOfRun = this.itemsFoundInCurrentRun === 0;
        if (isFirstItemOfRun) {
          this.firstItemOfRun = currentItemSnapshot;
        }
        this.lastProcessedItem = currentItemSnapshot;

        // 既知作品情報の事前確認
        const existingManga = Storage.getMangaByNormalized(parsed.normalizedTitle, crawlCategory);
        const isKnownInDatabase = existingManga !== undefined && parsed.maxVolume <= existingManga.maxVolume;
        const isNewVolume = existingManga === undefined || parsed.maxVolume > existingManga.maxVolume;

        // チェックポイントの更新処理（先頭アイテムが新規または既存チェックポイントと異なる場合）
        if (isFirstItemOfRun) {
          const isDiffFromExisting =
            !existingCheckpoint ||
            existingCheckpoint.title !== currentItemSnapshot.title ||
            existingCheckpoint.rawTitle !== currentItemSnapshot.rawTitle ||
            existingCheckpoint.maxVolume !== currentItemSnapshot.maxVolume;

          if (isDiffFromExisting && isNewVolume) {
            // 新着新巻を先頭で検出した場合、最新チェックポイントとして更新保存
            Storage.saveCheckpoint(currentItemSnapshot, crawlCategory);
            const prev = Storage.getPreviousCheckpoint(crawlCategory);
            targetStopCheckpoint = prev || existingCheckpoint;
            this.addLog(
              'checkpoint',
              `【最新コンテンツ記録】新着先頭記事「${parsed.cleanTitle}」(${parsed.displayVolume}) を最新チェックポイントとして更新保存しました。${
                targetStopCheckpoint ? `（※停止ターゲット: 「${targetStopCheckpoint.title} (${targetStopCheckpoint.displayVolume || targetStopCheckpoint.maxVolume + '巻'})」）` : ''
              }`,
              this.currentPage,
              { current: currentItemSnapshot, previous: prev }
            );
            this.broadcast('status_change', this.getState());
          }
        }

        // 4. 「既知作品で自動停止」判定
        if (this.currentSettings.stopOnCheckpoint) {
          // 判定1: チェックポイントとの一致判定
          const isCheckpointMatch =
            targetStopCheckpoint &&
            (parsed.cleanTitle === targetStopCheckpoint.title ||
              parsed.normalizedTitle === normalizeTitle(targetStopCheckpoint.title) ||
              parsed.rawTitle === targetStopCheckpoint.rawTitle) &&
            (parsed.maxVolume <= targetStopCheckpoint.maxVolume || parsed.rawTitle === targetStopCheckpoint.rawTitle);

          if (isCheckpointMatch) {
            stoppedByCheckpoint = true;
            matchedItemInfo = `${parsed.cleanTitle} (${parsed.displayVolume}) [チェックポイント一致]`;
            this.addLog(
              'checkpoint',
              isFirstItemOfRun
                ? `【チェックポイント到達（新着なし）】先頭記事「${parsed.cleanTitle}」(${parsed.displayVolume}) は保存済みチェックポイント「${targetStopCheckpoint?.title || ''}」と同一です。新着投稿がないため巡回を完了します。`
                : `【チェックポイント一致で自動停止】「${parsed.cleanTitle}」(${parsed.displayVolume}) は停止対象のチェックポイント「${targetStopCheckpoint?.title || ''}」と一致しました。これ以降は過去巡回済みのため自動停止します。`,
              this.currentPage,
              { checkpoint: targetStopCheckpoint, matchedPost: post }
            );
            break;
          }

          // 判定2: データベース上の既知作品（取得済み作品）との一致判定
          if (isKnownInDatabase) {
            consecutiveKnownItemsCount++;

            // 先頭記事がすでにDB登録済み（同一巻数以下）で新着巻がない場合 → 新着投稿なしとして即座に完了停止
            if (isFirstItemOfRun && !isNewVolume) {
              stoppedByCheckpoint = true;
              matchedItemInfo = `${parsed.cleanTitle} (${parsed.displayVolume}) [既知作品・新着なし]`;
              this.addLog(
                'checkpoint',
                `【既知作品検出で自動停止】先頭記事「${parsed.cleanTitle}」(${parsed.displayVolume}) はすでにデータベースに取得済みです。新着投稿がないため巡回を自動停止します。`,
                this.currentPage,
                { matchedPost: post, existingManga }
              );
              break;
            }

            // 新着記事を読み進めた後、DB既知作品が2件連続で現れた場合 → 過去巡回済みデータ領域に突入したため停止
            if (consecutiveKnownItemsCount >= 2) {
              stoppedByCheckpoint = true;
              matchedItemInfo = `${parsed.cleanTitle} (${parsed.displayVolume}) [既知作品連続検出]`;
              this.addLog(
                'checkpoint',
                `【既知作品連続検出で自動停止】データベース取得済みの既知作品を連続検出しました（最新: 「${parsed.cleanTitle}」(${parsed.displayVolume})）。過去巡回済みデータに到達したため自動停止します。`,
                this.currentPage,
                { matchedPost: post, existingManga }
              );
              break;
            }
          } else {
            consecutiveKnownItemsCount = 0;
          }
        }

        // 5. Rule 5: Aggregate title and max volume into database
        this.aggregateMangaItem(parsed, post.url, this.currentPage);
        this.itemsFoundInCurrentRun++;

        this.broadcast('item_scraped', {
          page: this.currentPage,
          index: i + 1,
          totalInPage: rawPosts.length,
          parsed,
          url: post.url,
        });
      }

      // Persist to disk after each page
      Storage.persistAll();

      if (stoppedByCheckpoint) {
        break;
      }

      // Check if we reached max pages
      if (this.currentPage >= this.maxPages) {
        this.addLog('info', `指定された最大ページ (${this.maxPages}) に到達しました。クロールを終了します。`, this.currentPage);
        break;
      }

      // Rule 1: WAIT interval between page requests
      if (!this.shouldStop && this.currentPage < this.maxPages) {
        const waitMs = this.currentSettings.waitMs || 1500;
        this.addLog('info', `次のページへ進む前に待機中 (${waitMs}ms)...`, this.currentPage);
        await this.sleep(waitMs);
      }

      this.currentPage++;
    }

    // クロール完了または中断時：今回の巡回で検出された先頭アイテムをチェックポイントとして確実に保存
    const finalCheckpointToSave = this.firstItemOfRun || this.lastProcessedItem;
    if (finalCheckpointToSave) {
      finalCheckpointToSave.category = crawlCategory;
      Storage.saveCheckpoint(finalCheckpointToSave, crawlCategory);
      this.addLog(
        'success',
        `巡回チェックポイント (${crawlCategory.toUpperCase()}) を確定保存しました: 「${finalCheckpointToSave.title}」 (最大巻数: ${finalCheckpointToSave.maxVolume}, ページ: ${finalCheckpointToSave.page})`
      );
    }

    const durationSeconds = Math.round((Date.now() - this.startTime) / 1000);
    this.lastStats = {
      totalPagesCrawled: stoppedByCheckpoint ? this.currentPage : Math.min(this.currentPage, this.maxPages),
      totalPostsParsed: this.itemsFoundInCurrentRun,
      newMangaAdded: this.newTitlesInCurrentRun,
      existingMangaUpdated: this.updatedTitlesInCurrentRun,
      startTime: new Date(this.startTime).toISOString(),
      endTime: new Date().toISOString(),
      durationSeconds,
      stoppedByCheckpoint,
      matchedCheckpointItem: matchedItemInfo,
    };
    Storage.saveStats(this.lastStats);
    Storage.persistAll();

    this.status = this.shouldStop ? 'stopped' : 'completed';
    this.addLog(
      'success',
      `クロール完了！ [カテゴリ: ${crawlCategory.toUpperCase()}] 処理ページ数: ${this.lastStats.totalPagesCrawled}, 解析件数: ${this.itemsFoundInCurrentRun}, 新規登録: ${this.newTitlesInCurrentRun}, 更新: ${this.updatedTitlesInCurrentRun} (所要時間: ${durationSeconds}秒)`
    );

    const finalState = this.getState();
    this.broadcast('status_change', finalState);
    this.broadcast('crawl_finished', {
      stats: this.lastStats,
      state: finalState,
    });
  }

  private aggregateMangaItem(parsed: ReturnType<typeof parsePostTitle>, url: string, page: number): void {
    const crawlCategory = this.getCrawlCategory();
    const existing = Storage.getMangaByNormalized(parsed.normalizedTitle, crawlCategory);
    const now = new Date().toISOString();

    const volumeRecord = {
      volume: parsed.maxVolume,
      rawVolumeStr: parsed.rawVolumeStr,
      postTitle: parsed.rawTitle,
      url,
      foundAt: now,
      page,
    };

    if (existing) {
      existing.category = crawlCategory;
      // Check if we found a higher volume
      const isNewHigher = parsed.maxVolume > existing.maxVolume;
      const newMax = Math.max(existing.maxVolume, parsed.maxVolume);

      // Avoid duplicate history entries
      const alreadyInHistory = existing.history.some((h) => h.url === url || h.postTitle === parsed.rawTitle);
      if (!alreadyInHistory) {
        existing.history.push(volumeRecord);
      }

      if (isNewHigher) {
        existing.maxVolume = newMax;
        existing.displayVolume = parsed.displayVolume || `第${newMax}巻`;
        existing.latestPostTitle = parsed.rawTitle;
        existing.latestUrl = url;
        existing.lastUpdatedAt = now;
        this.updatedTitlesInCurrentRun++;
      }

      Storage.upsertManga(existing);
    } else {
      // Create new item strictly under the crawlCategory ('manga' or 'magazine')
      const newItem: MangaItem = {
        id: Math.random().toString(36).substring(2, 11),
        title: parsed.cleanTitle,
        normalizedTitle: parsed.normalizedTitle,
        category: crawlCategory,
        author: parsed.author,
        maxVolume: parsed.maxVolume,
        displayVolume: parsed.displayVolume,
        latestPostTitle: parsed.rawTitle,
        latestUrl: url,
        firstSeenAt: now,
        lastUpdatedAt: now,
        history: [volumeRecord],
      };

      Storage.upsertManga(newItem);
      this.newTitlesInCurrentRun++;
    }
  }
}

export const scraperInstance = new ScraperEngine();
