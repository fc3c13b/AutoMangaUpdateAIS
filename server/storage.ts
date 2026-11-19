import fs from 'fs';
import path from 'path';
import { MangaItem, Checkpoint, CrawlLog, CrawlStats } from '../src/types.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const MANGA_FILE = path.join(DATA_DIR, 'manga_list.json');
const CHECKPOINT_FILE = path.join(DATA_DIR, 'checkpoint.json');
const STATS_FILE = path.join(DATA_DIR, 'stats.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export class Storage {
  private static mangaCache: Map<string, MangaItem> | null = null;
  private static categoryCheckpointCache: Record<string, {
    current: Checkpoint | null;
    previous: Checkpoint | null;
    history: Checkpoint[];
  }> = {
    manga: { current: null, previous: null, history: [] },
    magazine: { current: null, previous: null, history: [] },
  };
  private static checkpointsLoaded = false;

  public static getItemKey(category: string | undefined, normalizedTitle: string): string {
    const cat = (category || 'manga').toLowerCase().trim();
    const title = (normalizedTitle || '').toLowerCase().trim();
    return `${cat}:${title}`;
  }

  public static getMangaList(category?: string): MangaItem[] {
    if (!this.mangaCache) {
      try {
        if (fs.existsSync(MANGA_FILE)) {
          const raw = fs.readFileSync(MANGA_FILE, 'utf-8');
          const list: MangaItem[] = JSON.parse(raw);
          this.mangaCache = new Map(
            list.map((item) => [this.getItemKey(item.category, item.normalizedTitle), item])
          );
        } else {
          this.mangaCache = new Map();
        }
      } catch (e) {
        console.error('Failed to read manga_list.json:', e);
        this.mangaCache = new Map();
      }
    }

    const all = Array.from(this.mangaCache.values());
    if (category && category !== 'all') {
      const normalizedCat = category.toLowerCase().trim();
      return all.filter((item) => (item.category || 'manga').toLowerCase().trim() === normalizedCat);
    }
    return all;
  }

  public static getMangaByNormalized(normalizedTitle: string, category?: string): MangaItem | undefined {
    if (!this.mangaCache) {
      this.getMangaList();
    }
    const cat = (category || 'manga').toLowerCase().trim();
    const key = this.getItemKey(cat, normalizedTitle);
    const item = this.mangaCache?.get(key);
    if (item) return item;

    // Direct iteration fallback if key mismatch
    if (this.mangaCache) {
      for (const m of this.mangaCache.values()) {
        if (m.normalizedTitle === normalizedTitle && (!category || m.category === category)) {
          return m;
        }
      }
    }
    return undefined;
  }

  public static saveMangaList(list: MangaItem[]): void {
    try {
      this.mangaCache = new Map(
        list.map((item) => [this.getItemKey(item.category, item.normalizedTitle), item])
      );
      fs.writeFileSync(MANGA_FILE, JSON.stringify(list, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to save manga_list.json:', e);
    }
  }

  public static mergeMangaList(incomingList: MangaItem[]): { added: number; updated: number; total: number } {
    if (!this.mangaCache) {
      this.getMangaList();
    }
    let added = 0;
    let updated = 0;

    for (const incoming of incomingList) {
      if (!incoming || !incoming.title) continue;
      const cat = (incoming.category || 'manga').toLowerCase().trim();
      const norm = incoming.normalizedTitle || incoming.title.toLowerCase().replace(/\s+/g, '');
      const key = this.getItemKey(cat, norm);
      const existing = this.mangaCache?.get(key);

      if (!existing) {
        this.mangaCache?.set(key, { ...incoming, category: cat, normalizedTitle: norm });
        added++;
      } else {
        // Merge max volume
        const newMaxVolume = Math.max(existing.maxVolume || 0, incoming.maxVolume || 0);
        const isNewer = new Date(incoming.lastUpdatedAt || 0) > new Date(existing.lastUpdatedAt || 0);
        this.mangaCache?.set(key, {
          ...existing,
          category: cat,
          maxVolume: newMaxVolume,
          displayVolume: incoming.maxVolume > existing.maxVolume ? incoming.displayVolume : existing.displayVolume,
          latestPostTitle: isNewer ? incoming.latestPostTitle || existing.latestPostTitle : existing.latestPostTitle,
          latestUrl: isNewer ? incoming.latestUrl || existing.latestUrl : existing.latestUrl,
          lastUpdatedAt: isNewer ? incoming.lastUpdatedAt || existing.lastUpdatedAt : existing.lastUpdatedAt,
          author: existing.author || incoming.author,
        });
        updated++;
      }
    }

    this.persistAll();
    return {
      added,
      updated,
      total: this.mangaCache ? this.mangaCache.size : 0,
    };
  }

  public static upsertManga(item: MangaItem): void {
    if (!this.mangaCache) {
      this.getMangaList();
    }
    const cat = (item.category || 'manga').toLowerCase().trim();
    const key = this.getItemKey(cat, item.normalizedTitle);
    this.mangaCache?.set(key, item);
  }

  public static persistAll(): void {
    if (this.mangaCache) {
      const list = Array.from(this.mangaCache.values());
      try {
        fs.writeFileSync(MANGA_FILE, JSON.stringify(list, null, 2), 'utf-8');
      } catch (e) {
        console.error('Failed to persist manga list:', e);
      }
    }
  }

  private static loadCheckpoints(): void {
    if (this.checkpointsLoaded) return;
    try {
      if (fs.existsSync(CHECKPOINT_FILE)) {
        const raw = fs.readFileSync(CHECKPOINT_FILE, 'utf-8');
        const parsed = JSON.parse(raw);

        if (parsed.categories) {
          this.categoryCheckpointCache.manga = parsed.categories.manga || { current: null, previous: null, history: [] };
          this.categoryCheckpointCache.magazine = parsed.categories.magazine || { current: null, previous: null, history: [] };
        } else if (parsed.current || parsed.title) {
          // Legacy format migration -> manga category
          const cur = parsed.current || (parsed.title ? parsed : null);
          const prev = parsed.previous || cur?.previous || null;
          const hist = Array.isArray(parsed.history) ? parsed.history : [];
          this.categoryCheckpointCache.manga = {
            current: cur,
            previous: prev,
            history: hist,
          };
        }
      }
    } catch (e) {
      console.error('Failed to read checkpoint.json:', e);
    }
    this.checkpointsLoaded = true;
  }

  private static persistCheckpoints(lastActive?: Checkpoint | null): void {
    try {
      const payload = {
        categories: this.categoryCheckpointCache,
        current: lastActive || this.categoryCheckpointCache.manga.current || this.categoryCheckpointCache.magazine.current,
        previous: this.categoryCheckpointCache.manga.previous,
        history: this.categoryCheckpointCache.manga.history,
      };
      fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(payload, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to save checkpoint.json:', e);
    }
  }

  public static getCheckpoint(category: string = 'manga'): Checkpoint | null {
    this.loadCheckpoints();
    const cat = category.toLowerCase().trim() === 'magazine' ? 'magazine' : 'manga';
    return this.categoryCheckpointCache[cat]?.current || null;
  }

  public static getPreviousCheckpoint(category: string = 'manga'): Checkpoint | null {
    this.loadCheckpoints();
    const cat = category.toLowerCase().trim() === 'magazine' ? 'magazine' : 'manga';
    return this.categoryCheckpointCache[cat]?.previous || null;
  }

  public static getCheckpointHistory(category: string = 'manga'): Checkpoint[] {
    this.loadCheckpoints();
    const cat = category.toLowerCase().trim() === 'magazine' ? 'magazine' : 'manga';
    return this.categoryCheckpointCache[cat]?.history || [];
  }

  public static saveCheckpoint(cp: Checkpoint | null, category?: string): void {
    this.loadCheckpoints();
    const cat = (category || cp?.category || 'manga').toLowerCase().trim() === 'magazine' ? 'magazine' : 'manga';
    const state = this.categoryCheckpointCache[cat];

    if (cp === null) {
      state.current = null;
      state.previous = null;
      this.persistCheckpoints(null);
      return;
    }

    cp.category = cat;
    const existingCurrent = state.current;

    if (
      existingCurrent &&
      (existingCurrent.title !== cp.title ||
        existingCurrent.rawTitle !== cp.rawTitle ||
        existingCurrent.maxVolume !== cp.maxVolume ||
        existingCurrent.url !== cp.url)
    ) {
      const cleanPrev: Checkpoint = {
        title: existingCurrent.title,
        rawTitle: existingCurrent.rawTitle,
        maxVolume: existingCurrent.maxVolume,
        displayVolume: existingCurrent.displayVolume,
        url: existingCurrent.url,
        page: existingCurrent.page,
        savedAt: existingCurrent.savedAt,
        category: cat,
      };
      state.previous = cleanPrev;
      cp.previous = cleanPrev;

      const isAlreadyInHistory = state.history.some(
        (h) => h.rawTitle === cleanPrev.rawTitle && h.savedAt === cleanPrev.savedAt
      );
      if (!isAlreadyInHistory) {
        state.history = [cleanPrev, ...state.history].slice(0, 20);
      }
    } else if (cp.previous) {
      state.previous = cp.previous;
    } else if (state.previous) {
      cp.previous = state.previous;
    }

    state.current = cp;
    this.persistCheckpoints(cp);
  }

  public static rollbackCheckpoint(category: string = 'manga'): { success: boolean; checkpoint: Checkpoint | null } {
    this.loadCheckpoints();
    const cat = category.toLowerCase().trim() === 'magazine' ? 'magazine' : 'manga';
    const state = this.categoryCheckpointCache[cat];
    const prev = state.previous;

    if (!prev) {
      return { success: false, checkpoint: state.current };
    }

    const nextPrev = state.history.length > 0 ? state.history[0] : null;
    const restored: Checkpoint = {
      ...prev,
      category: cat,
      previous: nextPrev,
    };

    state.current = restored;
    state.previous = nextPrev;
    state.history = state.history.filter(
      (h) => !(h.rawTitle === prev.rawTitle && h.savedAt === prev.savedAt)
    );

    this.persistCheckpoints(restored);
    return { success: true, checkpoint: restored };
  }

  public static getStats(): CrawlStats | null {
    try {
      if (fs.existsSync(STATS_FILE)) {
        const raw = fs.readFileSync(STATS_FILE, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error('Failed to read stats.json:', e);
    }
    return null;
  }

  public static saveStats(stats: CrawlStats): void {
    try {
      fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to save stats.json:', e);
    }
  }

  public static clearAll(): void {
    this.mangaCache = new Map();
    this.categoryCheckpointCache = {
      manga: { current: null, previous: null, history: [] },
      magazine: { current: null, previous: null, history: [] },
    };
    this.checkpointsLoaded = true;
    try {
      if (fs.existsSync(MANGA_FILE)) fs.writeFileSync(MANGA_FILE, '[]', 'utf-8');
      if (fs.existsSync(CHECKPOINT_FILE)) fs.unlinkSync(CHECKPOINT_FILE);
      if (fs.existsSync(STATS_FILE)) fs.unlinkSync(STATS_FILE);
    } catch (e) {
      console.error('Failed to clear database files:', e);
    }
  }
}
