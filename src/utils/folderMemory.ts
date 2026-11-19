import { AppSettings, LocalMangaItem, RememberedFolderState, ScannedFolderRecord } from '../types';
import { cleanFolderName } from './mangaParser';

const IDB_NAME = 'AutoMangaUpdate_FolderMemory';
const IDB_VERSION = 1;
const IDB_STORE = 'handles';
const IDB_ROOT_KEY = 'remembered_root_folder';

const LS_FOLDER_MEMORY_KEY = 'automanga_remembered_folder_v1';
const LS_SCANNED_ITEMS_KEY = 'automanga_scanned_items_v1';
const LS_SETTINGS_KEY = 'automanga_app_settings_v1';

interface StoredIdbRecord {
  rootHandle: any;
  rootName: string;
  displayPath: string;
  savedAt: string;
}

function openFolderDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * 選択したルートフォルダの FileSystemDirectoryHandle とフォルダ名・パスを IndexedDB に永続化
 */
export async function saveRememberedRootHandle(
  rootHandle: any,
  rootName: string,
  displayPath: string
): Promise<void> {
  if (!rootHandle) return;
  try {
    const db = await openFolderDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      const payload: StoredIdbRecord = {
        rootHandle,
        rootName,
        displayPath,
        savedAt: new Date().toISOString(),
      };
      store.put(payload, IDB_ROOT_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.warn('IndexedDB rootHandle save skipped:', err);
  }
}

/**
 * IndexedDB から前回選択したルートフォルダハンドルを復元
 */
export async function loadRememberedRootHandle(): Promise<StoredIdbRecord | null> {
  try {
    const db = await openFolderDb();
    const record = await new Promise<StoredIdbRecord | null>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(IDB_ROOT_KEY);
      req.onsuccess = () => resolve((req.result as StoredIdbRecord) || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return record;
  } catch {
    return null;
  }
}

/**
 * 記憶したルートハンドルを削除
 */
export async function clearRememberedFolderMemory(): Promise<void> {
  try {
    localStorage.removeItem(LS_FOLDER_MEMORY_KEY);
    localStorage.removeItem(LS_SCANNED_ITEMS_KEY);
  } catch {}
  try {
    const db = await openFolderDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(IDB_ROOT_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {}
}

/**
 * フォルダ名・パス・スキャンしたサブフォルダ構造を localStorage に保存
 */
export function saveRememberedFolderState(state: RememberedFolderState): void {
  try {
    // directoryHandle などシリアライズ不可プロパティを除外して保存
    const serializable: RememberedFolderState = {
      rootName: state.rootName,
      displayPath: state.displayPath,
      sourceMode: state.sourceMode,
      scannedAt: state.scannedAt,
      scannedFolders: state.scannedFolders.map((f) => ({
        folderName: f.folderName,
        mangaTitle: f.mangaTitle,
        categoryFolder: f.categoryFolder,
        subFolderPath: f.subFolderPath,
      })),
    };
    localStorage.setItem(LS_FOLDER_MEMORY_KEY, JSON.stringify(serializable));
  } catch (err) {
    console.warn('Failed to save remembered folder state:', err);
  }
}

export function loadRememberedFolderState(): RememberedFolderState | null {
  try {
    const raw = localStorage.getItem(LS_FOLDER_MEMORY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RememberedFolderState;
    if (!parsed || typeof parsed.displayPath !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * スキャン済みアイテム一覧（Handle除く軽量メタ情報）を保存・復元
 */
export function saveRememberedScannedItems(items: LocalMangaItem[]): void {
  try {
    const serializable = items.map((item) => ({
      ...item,
      directoryHandle: undefined,
      files: item.files.map((f) => ({
        name: f.name,
        volume: f.volume,
        size: f.size,
        lastModified: f.lastModified,
      })),
    }));
    localStorage.setItem(LS_SCANNED_ITEMS_KEY, JSON.stringify(serializable));
  } catch {
    // quota超過時は無視
  }
}

export function loadRememberedScannedItems(): LocalMangaItem[] {
  try {
    const raw = localStorage.getItem(LS_SCANNED_ITEMS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePersistedSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
}

export function loadPersistedSettings(fallback: AppSettings): AppSettings {
  try {
    const raw = localStorage.getItem(LS_SETTINGS_KEY);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

/**
 * ルートフォルダ名と設定プレフィックスから表示用の完全パスを組み立てる
 */
export function computeRootDisplayPath(rootName: string, expectedPathPrefix?: string): string {
  const cleanRoot = (rootName || '').trim().replace(/[\\/]+$/, '');
  const prefix = (expectedPathPrefix || '').trim();
  if (!cleanRoot) {
    return prefix || 'M:\\MangaS\\Manga\\';
  }
  if (!prefix) {
    return `${cleanRoot}\\`;
  }
  const normalizedPrefix = prefix.replace(/[\\/]+$/, '');
  const prefixSegments = normalizedPrefix.split(/[\\/]/).filter(Boolean);
  const lastSegment = prefixSegments[prefixSegments.length - 1] || '';

  if (lastSegment.toLowerCase() === cleanRoot.toLowerCase()) {
    return `${normalizedPrefix}\\`;
  }
  if (prefixSegments.some((s) => s.toLowerCase() === cleanRoot.toLowerCase())) {
    const idx = prefixSegments.findIndex((s) => s.toLowerCase() === cleanRoot.toLowerCase());
    return `${prefixSegments.slice(0, idx + 1).join('\\')}\\`;
  }
  return `${normalizedPrefix}\\${cleanRoot}\\`;
}

/**
 * ルートパスとサブフォルダパスを結合した表示パスを返す
 */
export function buildFullDisplayPath(rootDisplayPath: string, subFolderPath: string, fileName?: string): string {
  const base = (rootDisplayPath || '').replace(/[\\/]+$/, '');
  const sub = (subFolderPath || '').replace(/^[\\/]+|[\\/]+$/g, '').replace(/\//g, '\\');
  const parts = [base, sub, fileName].filter((p) => p && p.length > 0);
  return parts.join('\\');
}

/**
 * タイトル照合用の正規化文字列
 */
export function normalizeForFolderMatch(input: string): string {
  return cleanFolderName(input || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/第\s*\d+(?:\.\d+)?\s*巻/g, '')
    .replace(/(?:vol\.?|volume|v)\s*\d+(?:\.\d+)?/gi, '')
    .replace(/[\s　\-_~〜!！?？:：・.,'"`()（）\[\]【】「」『』]/g, '');
}

function diceSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) {
    return a.includes(b) || b.includes(a) ? 0.8 : 0;
  }
  const bigramsA = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i++) {
    const bg = a.slice(i, i + 2);
    bigramsA.set(bg, (bigramsA.get(bg) || 0) + 1);
  }
  let intersection = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const bg = b.slice(i, i + 2);
    const count = bigramsA.get(bg) || 0;
    if (count > 0) {
      intersection++;
      bigramsA.set(bg, count - 1);
    }
  }
  return (2 * intersection) / (a.length - 1 + (b.length - 1));
}

export interface OptimalFolderResolution {
  subFolderPath: string;
  folderName: string;
  categoryFolder: string;
  matchedExisting: boolean;
  matchScore: number;
  directoryHandle?: any;
  fullDisplayPath: string;
}

/**
 * ダウンロードしたコンテンツのタイトル・アイテム情報から、
 * 記憶されているフォルダ群の中で最も適切な保存先サブフォルダを決定する
 */
export function findBestTargetFolder(params: {
  mangaTitle: string;
  item?: LocalMangaItem;
  scannedItems: LocalMangaItem[];
  rememberedFolders: ScannedFolderRecord[];
  rootName: string;
  rootDisplayPath: string;
}): OptimalFolderResolution {
  const { mangaTitle, item, scannedItems, rememberedFolders, rootName, rootDisplayPath } = params;

  // 1. 該当アイテム自体が有効な subFolderPath / directoryHandle を持つ場合は最優先
  if (item && item.subFolderPath && item.subFolderPath.trim().length > 0) {
    const matchedFolderRecord = rememberedFolders.find(
      (f) => f.subFolderPath === item.subFolderPath
    );
    return {
      subFolderPath: item.subFolderPath,
      folderName: item.folderName || mangaTitle,
      categoryFolder: item.categoryFolder || 'default',
      matchedExisting: true,
      matchScore: 100,
      directoryHandle: item.directoryHandle || matchedFolderRecord?.directoryHandle,
      fullDisplayPath: buildFullDisplayPath(rootDisplayPath, item.subFolderPath),
    };
  }

  const targetNorm = normalizeForFolderMatch(mangaTitle);
  const candidates: Array<{
    subFolderPath: string;
    folderName: string;
    categoryFolder: string;
    mangaTitle: string;
    directoryHandle?: any;
  }> = [];

  const seenPaths = new Set<string>();
  for (const sItem of scannedItems) {
    if (sItem.subFolderPath && !seenPaths.has(sItem.subFolderPath)) {
      seenPaths.add(sItem.subFolderPath);
      candidates.push({
        subFolderPath: sItem.subFolderPath,
        folderName: sItem.folderName,
        categoryFolder: sItem.categoryFolder,
        mangaTitle: sItem.mangaTitle,
        directoryHandle: sItem.directoryHandle,
      });
    }
  }
  for (const rf of rememberedFolders) {
    if (rf.subFolderPath && !seenPaths.has(rf.subFolderPath)) {
      seenPaths.add(rf.subFolderPath);
      candidates.push(rf);
    }
  }

  let bestCandidate: (typeof candidates)[number] | null = null;
  let bestScore = 0;

  if (targetNorm) {
    for (const cand of candidates) {
      const folderNorm = normalizeForFolderMatch(cand.folderName);
      const titleNorm = normalizeForFolderMatch(cand.mangaTitle);

      let score = 0;
      if (folderNorm === targetNorm || titleNorm === targetNorm) {
        score = 100;
      } else if (
        (folderNorm.length >= 2 && (targetNorm.includes(folderNorm) || folderNorm.includes(targetNorm))) ||
        (titleNorm.length >= 2 && (targetNorm.includes(titleNorm) || titleNorm.includes(targetNorm)))
      ) {
        const minLen = Math.min(
          targetNorm.length,
          Math.max(folderNorm.length, titleNorm.length)
        );
        const maxLen = Math.max(
          targetNorm.length,
          Math.max(folderNorm.length, titleNorm.length)
        );
        score = 72 + Math.round((minLen / Math.max(1, maxLen)) * 20);
      } else {
        const sim = Math.max(diceSimilarity(targetNorm, folderNorm), diceSimilarity(targetNorm, titleNorm));
        if (sim >= 0.55) {
          score = Math.round(sim * 70);
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestCandidate = cand;
      }
    }
  }

  if (bestCandidate && bestScore >= 55) {
    return {
      subFolderPath: bestCandidate.subFolderPath,
      folderName: bestCandidate.folderName,
      categoryFolder: bestCandidate.categoryFolder,
      matchedExisting: true,
      matchScore: bestScore,
      directoryHandle: bestCandidate.directoryHandle,
      fullDisplayPath: buildFullDisplayPath(rootDisplayPath, bestCandidate.subFolderPath),
    };
  }

  // 3. 一致する既存サブフォルダがない場合は、スキャン実績のある最適カテゴリフォルダ配下に新規作成パスを生成
  const safeFolderName = (mangaTitle || 'Unknown')
    .replace(/[\\/:*?"<>|]/g, '_')
    .trim();

  const lowerRoot = (rootName || '').toLowerCase();
  const rootAlreadyCategory = lowerRoot === 'manga 1st' || lowerRoot === 'manga 2nd';

  let defaultCategory = '';
  if (!rootAlreadyCategory) {
    const categoryCounts = new Map<string, number>();
    for (const c of candidates) {
      if (c.categoryFolder && c.categoryFolder !== 'default') {
        categoryCounts.set(c.categoryFolder, (categoryCounts.get(c.categoryFolder) || 0) + 1);
      }
    }
    let topCategory = '';
    let topCount = 0;
    for (const [cat, count] of categoryCounts.entries()) {
      if (count > topCount) {
        topCount = count;
        topCategory = cat;
      }
    }
    defaultCategory = topCategory || 'manga 1st';
  }

  const subFolderPath = defaultCategory ? `${defaultCategory}/${safeFolderName}` : safeFolderName;

  return {
    subFolderPath,
    folderName: safeFolderName,
    categoryFolder: defaultCategory || rootName || 'default',
    matchedExisting: false,
    matchScore: 0,
    directoryHandle: undefined,
    fullDisplayPath: buildFullDisplayPath(rootDisplayPath, subFolderPath),
  };
}
