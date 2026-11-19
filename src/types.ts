export type CrawlCategory = 'manga' | 'magazine';

export interface VolumeRecord {
  volume: number;
  rawVolumeStr: string;
  postTitle: string;
  url: string;
  foundAt: string;
  page: number;
}

/**
 * DL-RAW.SI クロールデータベースの漫画アイテム
 */
export interface DlRawMangaItem {
  id: string;
  title: string;             // クリーン化されたタイトル (例: "そうだ、売国しよう ～天才王子の赤字国家再生術～")
  normalizedTitle: string;   // 重複排除用正規化タイトル
  category: 'manga' | 'magazine' | string;
  author?: string;           // 抽出された作者名
  maxVolume: number;         // 検出された最大巻数
  displayVolume: string;     // e.g. "第19巻"
  latestPostTitle: string;   // 最新投稿記事タイトル
  latestUrl: string;         // 最新記事URL
  firstSeenAt: string;       // 初回登録日時
  lastUpdatedAt: string;     // 最終更新日時
  history: VolumeRecord[];   // 検出履歴
}

// 互換用エイリアス
export type MangaItem = DlRawMangaItem;

export interface Checkpoint {
  title: string;
  rawTitle: string;
  maxVolume: number;
  displayVolume: string;
  url: string;
  page: number;
  savedAt: string;
  category?: 'manga' | 'magazine' | string;
  previous?: Checkpoint | null;
}

export interface CheckpointHistoryRecord {
  title: string;
  rawTitle: string;
  maxVolume: number;
  displayVolume: string;
  url: string;
  page: number;
  savedAt: string;
  category?: 'manga' | 'magazine' | string;
}

export interface CrawlSettings {
  category: CrawlCategory;
  baseUrl: string;
  startPage: number;
  maxPages: number;
  waitMs: number;
  stopOnCheckpoint: boolean;
  mode: 'live' | 'simulation';
}

export interface CrawlStats {
  totalPagesCrawled: number;
  totalPostsParsed: number;
  newMangaAdded: number;
  existingMangaUpdated: number;
  startTime?: string;
  endTime?: string;
  durationSeconds?: number;
  stoppedByCheckpoint: boolean;
  matchedCheckpointItem?: string;
}

export type CrawlStatus = 'idle' | 'running' | 'paused' | 'completed' | 'stopped' | 'error';

export interface CrawlLog {
  id: string;
  timestamp: string;
  level: 'info' | 'success' | 'warning' | 'error' | 'checkpoint';
  page?: number;
  message: string;
  data?: any;
}

export interface ScraperState {
  status: CrawlStatus;
  currentPage: number;
  maxPages: number;
  currentPostIndex: number;
  totalPostsInPage: number;
  itemsFoundInCurrentRun: number;
  newTitlesInCurrentRun: number;
  updatedTitlesInCurrentRun: number;
  checkpoint: Checkpoint | null;
  previousCheckpoint?: Checkpoint | null;
  lastRunStats: CrawlStats | null;
  currentSettings: CrawlSettings;
  activeLog: CrawlLog[];
}

/**
 * ローカルPC (M:\MangaS\Manga) のファイル情報
 */
export interface MangaFile {
  name: string;
  volume: number;
  size: number;
  lastModified?: number;
  handle?: any; // FileSystemFileHandle
}

/**
 * ローカルPC (M:\MangaS\Manga) の漫画タイトル単位アイテム
 */
export interface LocalMangaItem {
  id: string;
  folderName: string;
  mangaTitle: string; // 抽出した hogehoge
  categoryFolder: string; // 例: manga 1st
  subFolderPath: string; // 例: manga 1st/MangaTitle
  ownedVolumes: number[];
  maxVolume: number;
  files: MangaFile[];
  directoryHandle?: any; // FileSystemDirectoryHandle (該当タイトルフォルダ)
  
  // 新刊チェック結果
  status: 'idle' | 'checking' | 'has_updates' | 'up_to_date' | 'error';
  availableNewVolumes: NewVolumeInfo[];
  lastChecked?: string;
  errorMessage?: string;
}

export interface DownloadLink {
  host: string; // 'rapidgator' | 'katfile' | 'rosefile' | 'mexashare' | 'alfafile' | 'ddownload' | 'other'
  url: string;
  size?: string;
  label?: string;
}

export interface NewVolumeInfo {
  volume: number;
  title: string;
  cleanTitle?: string;
  articleUrl?: string; // 記事詳細ページのURL
  downloadUrl?: string; // 選択中の代表DLリンク
  downloadLinks?: DownloadLink[]; // 記事内から抽出された全DL用リンク (Katfile, Rapidgator等)
  preferredHost?: string;
  source: string;
  releaseDate?: string;
  selected: boolean;
  downloadStatus?: 'pending' | 'downloading' | 'saving' | 'completed' | 'failed';
  downloadProgress?: number;
}

export interface AppSettings {
  customProjectUrl: string; // AI Studio の別PJ "MangaDLfromDL-RAW.SI" のURL
  expectedPathPrefix: string; // デフォルト: M:\MangaS\Manga\
  autoCheckOnScan: boolean;
  autoSaveToFolder: boolean;
  downloadFormat: 'rar' | 'zip' | 'cbz';
  searchSource: 'both' | 'custom_project' | 'dl_raw_direct';
  mockSimulationFallback: boolean;
  preferredHost: 'katfile' | 'rapidgator' | 'rosefile' | 'mexashare' | 'all';
  debridApiKey?: string;
  debridProvider?: 'real-debrid' | 'none';
}

export interface DownloadLogEntry {
  id: string;
  timestamp: string;
  title: string;
  volume: number;
  fileName: string;
  size?: number;
  status: 'success' | 'failed' | 'downloading';
  savedToPcFolder: boolean;
  destination: string;
  message: string;
  error?: string;
  downloadUrl?: string;
}

export interface ScannedFolderRecord {
  folderName: string;
  mangaTitle: string;
  categoryFolder: string;
  subFolderPath: string; // ルートからの相対パス (例: "manga 1st/呪術廻戦")
  directoryHandle?: any; // FileSystemDirectoryHandle
}

export interface RememberedFolderState {
  rootName: string;
  displayPath: string;
  sourceMode: 'fs_api' | 'webkitdirectory' | 'manual';
  scannedAt: string;
  scannedFolders: ScannedFolderRecord[];
}

export type RapidgatorQueueStatus =
  | 'queued'
  | 'waiting'
  | 'downloading'
  | 'captcha_required'
  | 'completed'
  | 'cancelled'
  | 'failed';

export interface RapidgatorQueueItem {
  id: string;
  itemId: string;
  mangaTitle: string;
  dlRawTitle: string;
  volume: number;
  targetFileName: string;
  rapidgatorUrl: string;
  subFolderPath: string;
  originalError: string;
  status: RapidgatorQueueStatus;
  waitTotalSec: number;
  waitRemainingSec: number;
  progressPercent?: number;
  statusMessage: string;
  rapidgatorFileSize?: string;
  createdAt: string;
  updatedAt: string;
}



