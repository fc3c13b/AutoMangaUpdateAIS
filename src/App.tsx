import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  FolderScanner 
} from './components/FolderScanner';
import { 
  MangaTable 
} from './components/MangaTable';
import { 
  NewVolumeModal 
} from './components/NewVolumeModal';
import { 
  SettingsModal 
} from './components/SettingsModal';
import { 
  ImportUrlsModal 
} from './components/ImportUrlsModal';
import { 
  ScriptGeneratorModal 
} from './components/ScriptGeneratorModal';
import {
  CrawlConsole
} from './components/CrawlConsole';
import {
  LiveLogViewer
} from './components/LiveLogViewer';
import {
  CheckpointCard
} from './components/CheckpointCard';
import {
  DlRawDatabaseTable
} from './components/DlRawDatabaseTable';
import {
  DlRawDetailModal
} from './components/DlRawDetailModal';
import {
  ParserPlayground
} from './components/ParserPlayground';
import {
  DownloadLogViewer
} from './components/DownloadLogViewer';
import { 
  LocalMangaItem, 
  MangaItem as DlRawMangaItem,
  NewVolumeInfo, 
  AppSettings,
  ScraperState,
  Checkpoint,
  CrawlSettings,
  CrawlLog,
  DownloadLogEntry,
  ScannedFolderRecord
} from './types';
import { 
  pickAndScanMangaDirectory, 
  scanDirectoryWithFolders,
  getMockSampleMangaList, 
  downloadPass1ToWebAppCache,
  downloadPass2ToBrowser,
  releaseWebAppCacheJob,
  triggerBrowserSaveFromBlobUrl,
  resolveOrCreateSubfolder,
  ensureDirectoryPermission,
  copyLocalFileChunked,
  isFileSystemAccessSupported,
  isRunningInIframe,
  getFileSystemAccessStatus
} from './utils/fileSystem';
import {
  saveRememberedRootHandle,
  loadRememberedRootHandle,
  clearRememberedFolderMemory,
  saveRememberedFolderState,
  loadRememberedFolderState,
  saveRememberedScannedItems,
  loadRememberedScannedItems,
  savePersistedSettings,
  loadPersistedSettings,
  computeRootDisplayPath,
  buildFullDisplayPath,
  findBestTargetFolder,
} from './utils/folderMemory';
import { parseMangaFilename, cleanFolderName } from './utils/mangaParser';
import { 
  FolderSync, 
  Settings, 
  Terminal, 
  CheckCircle2, 
  AlertCircle,
  AlertTriangle,
  Sparkles,
  Link2,
  ChevronRight,
  Database,
  Layers,
  Wrench,
  HardDrive,
  Download,
  Check,
  X
} from 'lucide-react';

const DEFAULT_SETTINGS: AppSettings = {
  customProjectUrl: '',
  expectedPathPrefix: 'M:\\MangaS\\Manga\\',
  autoCheckOnScan: true,
  autoSaveToFolder: true,
  downloadFormat: 'rar',
  searchSource: 'both',
  mockSimulationFallback: false,
  preferredHost: 'all',
};

export default function App() {
  // ナビゲーションタブ
  const [activeTab, setActiveTab] = useState<'local_sync' | 'dl_raw_db' | 'playground'>('local_sync');

  // ローカルPCマンガ管理ステート
  const [items, setItems] = useState<LocalMangaItem[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('未選択 (サンプルデータ読込可能)');
  const [isScanning, setIsScanning] = useState(false);
  const [isCheckingNewReleases, setIsCheckingNewReleases] = useState(false);
  const [selectedMangaForModal, setSelectedMangaForModal] = useState<LocalMangaItem | null>(null);

  // ダウンロード実行ログ管理
  const [downloadLogs, setDownloadLogs] = useState<DownloadLogEntry[]>(() => {
    try {
      const saved = localStorage.getItem('auto_update_download_logs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const addDownloadLog = (entry: DownloadLogEntry) => {
    setDownloadLogs((prev) => {
      const updated = [entry, ...prev.filter((l) => l.id !== entry.id).slice(0, 99)];
      try { localStorage.setItem('auto_update_download_logs', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const updateDownloadLog = (id: string, patch: Partial<DownloadLogEntry>) => {
    setDownloadLogs((prev) => {
      const updated = prev.map((l) => (l.id === id ? { ...l, ...patch } : l));
      try { localStorage.setItem('auto_update_download_logs', JSON.stringify(updated)); } catch {}
      return updated;
    });
  };

  const clearDownloadLogs = () => {
    setDownloadLogs([]);
    try { localStorage.removeItem('auto_update_download_logs'); } catch {}
    showToast('ダウンロードログをクリアしました', 'info');
  };

  // モーダル管理
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isScriptModalOpen, setIsScriptModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(() => loadPersistedSettings(DEFAULT_SETTINGS));
  const [toastMessage, setToastMessage] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showClarificationCard, setShowClarificationCard] = useState(true);

  // DL-RAW クローラー連携ステート (別PJ取り込み)
  const [scraperState, setScraperState] = useState<ScraperState | null>(null);
  const [activeCategory, setActiveCategory] = useState<'manga' | 'magazine'>('manga');
  const [checkpoint, setCheckpoint] = useState<Checkpoint | null>(null);
  const [previousCheckpoint, setPreviousCheckpoint] = useState<Checkpoint | null>(null);
  const [checkpointHistory, setCheckpointHistory] = useState<Checkpoint[]>([]);
  const [logs, setLogs] = useState<CrawlLog[]>([]);
  const [selectedDbManga, setSelectedDbManga] = useState<DlRawMangaItem | null>(null);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [totalDbCount, setTotalDbCount] = useState<number>(0);

  // ルートフォルダハンドル ＆ 記憶フォルダ情報 (ローカルフォルダスキャン用)
  const [rootDirectoryHandle, setRootDirectoryHandle] = useState<any>(null);
  const [rememberedRootName, setRememberedRootName] = useState<string>('');
  const [rememberedFolders, setRememberedFolders] = useState<ScannedFolderRecord[]>([]);

  const batchAbortRef = useRef<boolean>(false);

  // 2パス分割ダウンロード進行状況（1冊ごとに .rar を個別保存）
  const [streamProgress, setStreamProgress] = useState<{
    isActive: boolean;
    status: 'downloading' | 'completed' | 'error';
    phase: 'pass1' | 'pass2';
    currentTitle: string;
    currentVolume: number;
    currentIndex: number;
    totalCount: number;
    receivedBytes: number;
    totalBytes: number;
    speedMb?: string;
    currentStep: string;
    aborted?: boolean;
    directSaveNote?: string;
    completedList: Array<{
      itemId: string;
      jobId: string;
      title: string;
      volume: number;
      fileName: string;
      size: number;
      blobUrl?: string;
      cachedUrl: string;
      downloadUrl?: string;
      isSim?: boolean;
      savedToPcFolder?: boolean;
      targetFolderPath?: string;
      saveFallbackReason?: string;
    }>;
    errors: Array<{
      label: string;
      reason: string;
    }>;
    errorMessage?: string;
  }>({
    isActive: false,
    status: 'downloading',
    phase: 'pass1',
    currentTitle: '',
    currentVolume: 0,
    currentIndex: 0,
    totalCount: 0,
    receivedBytes: 0,
    totalBytes: 0,
    currentStep: '',
    directSaveNote: undefined,
    completedList: [],
    errors: [],
  });

  const closeStreamProgressModal = () => {
    batchAbortRef.current = true;
    setStreamProgress((prev) => {
      prev.completedList.forEach((c) => {
        if (c.blobUrl) {
          try { URL.revokeObjectURL(c.blobUrl); } catch {}
        }
      });
      return {
        ...prev,
        isActive: false,
      };
    });
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage({ message, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // ----------------------------------------------------
  // クローラー状態取得 & SSE 購読 (添付コード完全連携)
  // ----------------------------------------------------
  const fetchCrawlerStatus = useCallback(async (cat?: 'manga' | 'magazine') => {
    const targetCat = cat || activeCategory;
    try {
      const res = await fetch(`/api/status?category=${targetCat}`);
      const data = await res.json();
      if (data.success) {
        setScraperState(data.state);
        setCheckpoint(data.checkpoint);
        setPreviousCheckpoint(data.previousCheckpoint || data.checkpoint?.previous || null);
        if (data.checkpointHistory) setCheckpointHistory(data.checkpointHistory);
        if (data.mangaCount !== undefined) setTotalDbCount(data.mangaCount);
        if (data.state?.activeLog) setLogs(data.state.activeLog);
      }
    } catch (e) {
      console.warn('Crawler status fetch failed:', e);
    }
  }, [activeCategory]);

  useEffect(() => {
    fetchCrawlerStatus();

    const eventSource = new EventSource('/api/crawl/events');
    eventSource.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        if (event.type === 'init' || event.type === 'status_change') {
          setScraperState(event.payload);
          if (event.payload.checkpoint) setCheckpoint(event.payload.checkpoint);
        } else if (event.type === 'log') {
          setLogs((prev) => [event.payload, ...prev]);
        } else if (event.type === 'crawl_finished') {
          setScraperState(event.payload.state);
          setRefreshKey((k) => k + 1);
          showToast('DL-RAW巡回クロールが完了しました！', 'success');
        }
      } catch (err) {
        console.warn('SSE parse error:', err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [fetchCrawlerStatus]);

  // 起動時に前回選択したフォルダ名・パス・サブフォルダ構造・ディレクトリハンドルを復元
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const savedFolder = loadRememberedFolderState();
      const savedItems = loadRememberedScannedItems();
      const idbRecord = await loadRememberedRootHandle();

      if (cancelled) return;

      if (savedFolder) {
        setCurrentPath(savedFolder.displayPath);
        setRememberedRootName(savedFolder.rootName);
        setRememberedFolders(savedFolder.scannedFolders || []);
      } else if (idbRecord) {
        setCurrentPath(idbRecord.displayPath);
        setRememberedRootName(idbRecord.rootName);
      }

      if (savedItems.length > 0) {
        setItems(savedItems);
      }

      if (idbRecord?.rootHandle) {
        setRootDirectoryHandle(idbRecord.rootHandle);
        // 既に許可済みのハンドルであれば起動時にサブフォルダハンドルも自動再紐付け
        try {
          const perm = await idbRecord.rootHandle.queryPermission?.({ mode: 'readwrite' });
          if (perm === 'granted' && !cancelled) {
            const { mangaList, scannedFolders } = await scanDirectoryWithFolders(idbRecord.rootHandle, '');
            if (!cancelled) {
              setItems(mangaList);
              setRememberedFolders(scannedFolders);
              saveRememberedScannedItems(mangaList);
            }
          }
        } catch {
          // 次回ユーザー操作時に再許可を要求する
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // クロール操作
  const handleStartCrawl = async (crawlSettings: CrawlSettings) => {
    try {
      const res = await fetch('/api/crawl/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...crawlSettings, category: crawlSettings.category || activeCategory }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, 'success');
        setScraperState(data.state);
      } else {
        showToast(data.message || '開始できませんでした', 'error');
      }
    } catch (e: any) {
      showToast(`クロール開始エラー: ${e.message}`, 'error');
    }
  };

  const handleStopCrawl = async () => {
    try {
      const res = await fetch('/api/crawl/stop', { method: 'POST' });
      const data = await res.json();
      showToast(data.message || 'クロールを停止しました', 'info');
      fetchCrawlerStatus();
    } catch (e: any) {
      showToast(`停止エラー: ${e.message}`, 'error');
    }
  };

  const handleResetCrawl = async () => {
    try {
      const res = await fetch('/api/crawl/reset', { method: 'POST' });
      const data = await res.json();
      showToast(data.message, 'info');
      fetchCrawlerStatus();
    } catch (e: any) {
      showToast(`リセットエラー: ${e.message}`, 'error');
    }
  };

  const handlePauseCrawl = async () => {
    await fetch('/api/crawl/pause', { method: 'POST' });
    fetchCrawlerStatus();
  };

  const handleResumeCrawl = async () => {
    await fetch('/api/crawl/resume', { method: 'POST' });
    fetchCrawlerStatus();
  };

  const handleExport = (format: 'json' | 'csv') => {
    window.location.href = `/api/export?format=${format}`;
    showToast(`${format.toUpperCase()}ファイルをダウンロードします`, 'success');
  };

  // ----------------------------------------------------
  // ローカルフォルダスキャン (M:\MangaS\Manga\) + フォルダ名・パス記憶
  // ----------------------------------------------------
  const persistScannedFolderMemory = async (params: {
    rootName: string;
    displayPath: string;
    sourceMode: 'fs_api' | 'webkitdirectory' | 'manual';
    scannedFolders: ScannedFolderRecord[];
    scannedItems: LocalMangaItem[];
    rootHandle?: any;
  }) => {
    setRememberedRootName(params.rootName);
    setRememberedFolders(params.scannedFolders);
    setCurrentPath(params.displayPath);
    saveRememberedFolderState({
      rootName: params.rootName,
      displayPath: params.displayPath,
      sourceMode: params.sourceMode,
      scannedAt: new Date().toISOString(),
      scannedFolders: params.scannedFolders,
    });
    saveRememberedScannedItems(params.scannedItems);
    if (params.rootHandle) {
      await saveRememberedRootHandle(params.rootHandle, params.rootName, params.displayPath);
    }
  };

  const handlePickDirectory = async () => {
    setIsScanning(true);
    try {
      const result = await pickAndScanMangaDirectory();
      const displayPath = computeRootDisplayPath(result.rootName, settings.expectedPathPrefix);
      setRootDirectoryHandle(result.rootHandle);
      setItems(result.mangaList);

      await persistScannedFolderMemory({
        rootName: result.rootName,
        displayPath,
        sourceMode: 'fs_api',
        scannedFolders: result.scannedFolders,
        scannedItems: result.mangaList,
        rootHandle: result.rootHandle,
      });

      showToast(
        `フォルダ「${result.rootName}」を記憶・走査完了 (${result.mangaList.length}作品 / ${result.scannedFolders.length}フォルダ)`,
        'success'
      );

      if (settings.autoCheckOnScan && result.mangaList.length > 0) {
        checkNewReleasesForItems(result.mangaList);
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        showToast(error.message || 'フォルダ選択に失敗しました', 'error');
      }
    } finally {
      setIsScanning(false);
    }
  };

  const handleRescanRememberedDirectory = async () => {
    if (!rootDirectoryHandle) {
      await handlePickDirectory();
      return;
    }
    setIsScanning(true);
    try {
      const granted = await ensureDirectoryPermission(rootDirectoryHandle);
      if (!granted) {
        showToast('フォルダへのアクセス権限が許可されませんでした', 'error');
        return;
      }
      const { mangaList, scannedFolders } = await scanDirectoryWithFolders(rootDirectoryHandle, '');
      const rootName = rootDirectoryHandle.name || rememberedRootName || 'Manga';
      const displayPath = currentPath && !currentPath.startsWith('未選択')
        ? currentPath
        : computeRootDisplayPath(rootName, settings.expectedPathPrefix);

      setItems(mangaList);
      await persistScannedFolderMemory({
        rootName,
        displayPath,
        sourceMode: 'fs_api',
        scannedFolders,
        scannedItems: mangaList,
        rootHandle: rootDirectoryHandle,
      });

      showToast(
        `記憶フォルダ「${rootName}」を再スキャンしました (${mangaList.length}作品 / ${scannedFolders.length}フォルダ)`,
        'success'
      );
      if (settings.autoCheckOnScan && mangaList.length > 0) {
        checkNewReleasesForItems(mangaList);
      }
    } catch (error: any) {
      showToast(error?.message || '記憶フォルダの再スキャンに失敗しました', 'error');
    } finally {
      setIsScanning(false);
    }
  };

  const handleClearFolderMemory = async () => {
    await clearRememberedFolderMemory();
    setRootDirectoryHandle(null);
    setRememberedRootName('');
    setRememberedFolders([]);
    setItems([]);
    setCurrentPath('未選択 (サンプルデータ読込可能)');
    showToast('記憶していたフォルダ情報をリセットしました', 'info');
  };

  const handleManualPathChange = (newPath: string) => {
    setCurrentPath(newPath);
    const segments = newPath.split(/[\\/]/).filter(Boolean);
    const inferredRootName = rememberedRootName || segments[segments.length - 1] || 'Manga';
    setRememberedRootName(inferredRootName);
    saveRememberedFolderState({
      rootName: inferredRootName,
      displayPath: newPath,
      sourceMode: rootDirectoryHandle ? 'fs_api' : 'manual',
      scannedAt: new Date().toISOString(),
      scannedFolders: rememberedFolders,
    });
    if (rootDirectoryHandle) {
      saveRememberedRootHandle(rootDirectoryHandle, inferredRootName, newPath);
    }
    showToast(`対象パスを記憶しました: ${newPath}`, 'info');
  };

  const handleLoadSampleData = () => {
    const sample = getMockSampleMangaList();
    setItems(sample);
    setCurrentPath('M:\\MangaS\\Manga (検証用サンプルデータ)');
    showToast(`検証用サンプルデータ (${sample.length}作品) を読み込みました`, 'success');
  };

  const handleManualFilesUpload = (files: FileList) => {
    const fileList = Array.from(files);
    if (fileList.length === 0) return;

    // 1. アップロードされたルートフォルダ名を取得して currentPath を即時反映・記憶
    const firstRel = fileList[0]?.webkitRelativePath || '';
    let detectedPath = '';
    let detectedRootName = '';
    if (firstRel) {
      const parts = firstRel.split('/');
      const rootFolderName = parts[0];
      detectedRootName = rootFolderName;
      detectedPath = computeRootDisplayPath(rootFolderName, settings.expectedPathPrefix);
    } else {
      detectedRootName = `選択フォルダ`;
      detectedPath = `選択フォルダ (${fileList.length}ファイル)`;
    }
    setCurrentPath(detectedPath);

    // 2. ファイルを走査してマンガタイトル・巻数・フォルダ構造を高精度解析
    const map = new Map<string, LocalMangaItem>();
    const folderMap = new Map<string, ScannedFolderRecord>();

    fileList.forEach((f) => {
      const parts = f.webkitRelativePath ? f.webkitRelativePath.split('/') : [f.name];
      // 先頭のルートフォルダ名自身を除いた相対パス（rootHandle直下に揃える）
      const relParts = parts.length > 1 ? parts.slice(1, -1) : [];
      const subPath = relParts.length > 0 ? relParts.join('/') : parts.slice(0, -1).join('/');
      const folderTitle = relParts.length > 0 ? relParts[relParts.length - 1] : (parts.length > 1 ? parts[0] : 'Unknown');
      const category = relParts.length > 1 ? relParts[0] : (detectedRootName || 'default');

      if (subPath && !folderMap.has(subPath)) {
        folderMap.set(subPath, {
          folderName: folderTitle,
          mangaTitle: cleanFolderName(folderTitle),
          categoryFolder: category,
          subFolderPath: subPath,
        });
      }

      const isMangaFile = /\.(cbz|zip|rar|cbr)$/i.test(f.name);
      if (!isMangaFile) return;

      // ファイル名から hogehoge と 巻数 を抽出
      const { title: parsedTitle, volume } = parseMangaFilename(f.name, folderTitle);
      const effectiveTitle = parsedTitle || cleanFolderName(folderTitle);
      const key = `${category}:::${folderTitle}`;

      if (!map.has(key)) {
        map.set(key, {
          id: key,
          folderName: folderTitle,
          mangaTitle: effectiveTitle,
          categoryFolder: category,
          subFolderPath: subPath,
          ownedVolumes: volume > 0 ? [volume] : [],
          maxVolume: volume,
          files: [{ name: f.name, volume, size: f.size }],
          status: 'idle',
          availableNewVolumes: [],
        });
      } else {
        const item = map.get(key)!;
        item.files.push({ name: f.name, volume, size: f.size });
        if (volume > 0 && !item.ownedVolumes.includes(volume)) {
          item.ownedVolumes.push(volume);
        }
        if (volume > item.maxVolume) {
          item.maxVolume = volume;
        }
        if (parsedTitle && parsedTitle.length > item.mangaTitle.length) {
          item.mangaTitle = parsedTitle;
        }
      }
    });

    const parsedList = Array.from(map.values()).map((item) => {
      item.ownedVolumes.sort((a, b) => a - b);
      item.files.sort((a, b) => a.volume - b.volume);
      return item;
    });
    const scannedFolders = Array.from(folderMap.values());

    setItems(parsedList);
    void persistScannedFolderMemory({
      rootName: detectedRootName,
      displayPath: detectedPath,
      sourceMode: 'webkitdirectory',
      scannedFolders,
      scannedItems: parsedList,
    });

    showToast(`フォルダ「${detectedPath}」(${scannedFolders.length}サブフォルダ) を記憶し、${parsedList.length}作品を読み込みました`, 'success');

    if (settings.autoCheckOnScan && parsedList.length > 0) {
      checkNewReleasesForItems(parsedList);
    }
  };

  // ----------------------------------------------------
  // 新刊チェック (DL-RAW.SI ＆ クローラーDB連携)
  // ----------------------------------------------------
  const handleCheckSingle = async (targetItem: LocalMangaItem) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === targetItem.id ? { ...i, status: 'checking', errorMessage: undefined } : i
      )
    );

    try {
      const res = await fetch('/api/search-manga', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: targetItem.mangaTitle,
          currentMaxVol: targetItem.maxVolume,
          preferredHost: settings.preferredHost,
          searchSource: settings.searchSource,
          allowSimulation: settings.mockSimulationFallback,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.error || `検索エラー (HTTP ${res.status})`);
      }

      let found: NewVolumeInfo[] = (data.foundVolumes || []).filter(
        (v: NewVolumeInfo) => !/novel/i.test((v.title || '').normalize('NFKC'))
      );

      // 検索結果 (実在の新刊のみ。シミュレーション設定OFF時は架空巻数を生成しない)
      if (found.length === 0 && settings.mockSimulationFallback && targetItem.maxVolume > 0) {
        const nextVol = targetItem.maxVolume + 1;
        found = [
          {
            volume: nextVol,
            title: `${targetItem.mangaTitle} 第${nextVol}巻`,
            source: 'DL-RAW.SI',
            selected: true,
            downloadLinks: [
              { host: 'katfile', url: `https://katfile.com/sim/${encodeURIComponent(targetItem.mangaTitle)}_v${nextVol}.rar`, label: 'KATFILE' },
              { host: 'rapidgator', url: `https://rapidgator.net/file/sim/${encodeURIComponent(targetItem.mangaTitle)}_v${nextVol}.rar`, label: 'RAPIDGATOR' },
              { host: 'rosefile', url: `https://rosefile.net/sim/${encodeURIComponent(targetItem.mangaTitle)}_v${nextVol}.rar`, label: 'ROSEFILE' },
            ],
          },
        ];
      }

      setItems((prev) =>
        prev.map((i) => {
          if (i.id === targetItem.id) {
            return {
              ...i,
              status: found.length > 0 ? 'has_updates' : 'up_to_date',
              availableNewVolumes: found,
              errorMessage: undefined,
              lastChecked: new Date().toLocaleTimeString(),
            };
          }
          return i;
        })
      );

      if (found.length > 0) {
        showToast(`${targetItem.mangaTitle}: 新刊 (第${found.map((v) => v.volume).join(', ')}巻) が見つかりました！`, 'success');
      } else {
        showToast(`${targetItem.mangaTitle}: 最新巻まで所持しています`, 'info');
      }
    } catch (err: any) {
      const errMsg = err?.message || 'DL-RAW.SI の検索に失敗しました';
      setItems((prev) =>
        prev.map((i) =>
          i.id === targetItem.id
            ? {
                ...i,
                status: 'error',
                errorMessage: errMsg,
                lastChecked: new Date().toLocaleTimeString(),
              }
            : i
        )
      );
      showToast(`${targetItem.mangaTitle} 検索エラー: ${errMsg}`, 'error');
    }
  };

  const checkNewReleasesForItems = async (itemsToCheck: LocalMangaItem[]) => {
    if (itemsToCheck.length === 0) return;
    setIsCheckingNewReleases(true);
    let newReleaseCount = 0;
    let errorCount = 0;
    let successCount = 0;
    let lastErrorMessage = '';

    const checkIds = new Set(itemsToCheck.map((i) => i.id));
    setItems((prev) =>
      prev.map((i) => (checkIds.has(i.id) ? { ...i, status: 'checking', errorMessage: undefined } : i))
    );

    for (const item of itemsToCheck) {
      try {
        const res = await fetch('/api/search-manga', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            keyword: item.mangaTitle,
            currentMaxVol: item.maxVolume,
            preferredHost: settings.preferredHost,
            searchSource: settings.searchSource,
            allowSimulation: settings.mockSimulationFallback,
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) {
          throw new Error(data.error || `検索エラー (HTTP ${res.status})`);
        }

        let found: NewVolumeInfo[] = (data.foundVolumes || []).filter(
          (v: NewVolumeInfo) => !/novel/i.test((v.title || '').normalize('NFKC'))
        );

        // シミュレーション設定がONの場合のみ検証用フォールバック
        if (found.length === 0 && settings.mockSimulationFallback && item.maxVolume > 0) {
          const nextVol = item.maxVolume + 1;
          found = [
            {
              volume: nextVol,
              title: `${item.mangaTitle} 第${nextVol}巻`,
              source: 'DL-RAW.SI',
              selected: true,
              downloadLinks: [
                { host: 'katfile', url: `https://katfile.com/sim/${encodeURIComponent(item.mangaTitle)}_v${nextVol}.rar`, label: 'KATFILE' },
                { host: 'rapidgator', url: `https://rapidgator.net/file/sim/${encodeURIComponent(item.mangaTitle)}_v${nextVol}.rar`, label: 'RAPIDGATOR' },
                { host: 'rosefile', url: `https://rosefile.net/sim/${encodeURIComponent(item.mangaTitle)}_v${nextVol}.rar`, label: 'ROSEFILE' },
              ],
            },
          ];
        }

        successCount++;
        if (found.length > 0) {
          newReleaseCount += found.length;
        }

        setItems((prev) =>
          prev.map((i) => {
            if (i.id === item.id) {
              return {
                ...i,
                status: found.length > 0 ? 'has_updates' : 'up_to_date',
                availableNewVolumes: found,
                errorMessage: undefined,
                lastChecked: new Date().toLocaleTimeString(),
              };
            }
            return i;
          })
        );
      } catch (err: any) {
        errorCount++;
        const errMsg = err?.message || 'DL-RAW.SI の検索に失敗しました';
        lastErrorMessage = errMsg;
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  status: 'error',
                  errorMessage: errMsg,
                  lastChecked: new Date().toLocaleTimeString(),
                }
              : i
          )
        );
      }
    }

    setIsCheckingNewReleases(false);
    if (errorCount > 0 && successCount === 0) {
      showToast(`検索失敗 (${errorCount}件エラー): ${lastErrorMessage}`, 'error');
    } else if (errorCount > 0) {
      showToast(
        `一括チェック完了 (一部検索失敗): 新刊 ${newReleaseCount}冊検出 / ${errorCount}件エラー (${lastErrorMessage})`,
        'error'
      );
    } else {
      showToast(`一括チェック完了: 合計 ${newReleaseCount}冊の新刊を検出しました`, 'success');
    }
  };

  // ----------------------------------------------------
  // 2パス個別DL (Pass 1: Webアプリ内取得 → Pass 2: 記憶した最適フォルダへ直接保存 or ブラウザDL)
  // ----------------------------------------------------
  const executeDownloadBatch = async (
    targetItems: Array<{ item: LocalMangaItem; volumes: NewVolumeInfo[] }>,
    options?: { forceBrowserOnly?: boolean }
  ) => {
    const totalCount = targetItems.reduce((acc, t) => acc + t.volumes.length, 0);
    if (totalCount === 0) return;

    batchAbortRef.current = false;

    // ユーザークリック直後にルートフォルダへの書き込み権限を確保（非同期ループ内での失効防止）
    let activeRootHandle = rootDirectoryHandle;
    let canWriteToRoot = false;
    let directSaveNote: string | undefined;

    if (options?.forceBrowserOnly) {
      directSaveNote = '「ブラウザDLのみ」が選択されたためブラウザのダウンロード先へ保存します';
    } else if (!settings.autoSaveToFolder) {
      directSaveNote = '設定でフォルダ直接保存がOFFのためブラウザのダウンロード先へ保存します';
    } else {
      if (!activeRootHandle && !isRunningInIframe() && isFileSystemAccessSupported()) {
        try {
          // @ts-ignore
          const picked = await window.showDirectoryPicker({ mode: 'readwrite' });
          if (picked) {
            activeRootHandle = picked;
            setRootDirectoryHandle(picked);
            const resolvedRootName = picked.name || rememberedRootName || 'Manga';
            const resolvedDisplayPath =
              currentPath && !currentPath.startsWith('未選択') && !currentPath.includes('サンプル')
                ? currentPath
                : computeRootDisplayPath(resolvedRootName, settings.expectedPathPrefix);
            setRememberedRootName(resolvedRootName);
            setCurrentPath(resolvedDisplayPath);
            await saveRememberedRootHandle(picked, resolvedRootName, resolvedDisplayPath);
          }
        } catch (err: any) {
          if (err?.name === 'AbortError') {
            directSaveNote = '保存先フォルダの選択がキャンセルされたためブラウザDLへ保存します';
          } else {
            directSaveNote = err?.message || 'フォルダ選択に失敗したためブラウザDLへ保存します';
          }
        }
      }

      if (activeRootHandle) {
        canWriteToRoot = await ensureDirectoryPermission(activeRootHandle);
        if (!canWriteToRoot) {
          directSaveNote = 'フォルダへの書き込み権限が拒否されたためブラウザDLへ保存します';
        }
      } else if (!directSaveNote) {
        const fsStatus = getFileSystemAccessStatus();
        if (!fsStatus.supported) {
          directSaveNote = fsStatus.reason || 'お使いのブラウザはフォルダ直接書き込みAPIに非対応のためブラウザDLへ保存します';
        } else if (fsStatus.inIframe) {
          directSaveNote = 'プレビュー画面(iframe内)ではブラウザ制限により直接保存できないためブラウザDLへ保存します（新しいタブで開くと直接保存可能）';
        } else {
          directSaveNote = '「PCフォルダ同期・直接保存」で保存先フォルダが未指定のためブラウザDLへ保存します';
        }
      }
    }

    setStreamProgress({
      isActive: true,
      status: 'downloading',
      phase: 'pass1',
      currentTitle: '',
      currentVolume: 0,
      currentIndex: 0,
      totalCount,
      receivedBytes: 0,
      totalBytes: 38 * 1024 * 1024,
      speedMb: '0.00',
      currentStep: '[Pass 1/2] Webアプリ内ダウンロードを準備中...',
      aborted: false,
      directSaveNote,
      completedList: [],
      errors: [],
    });

    let overallIndex = 0;
    const completedList: Array<{
      itemId: string;
      jobId: string;
      title: string;
      volume: number;
      fileName: string;
      size: number;
      blobUrl?: string;
      cachedUrl: string;
      downloadUrl?: string;
      isSim?: boolean;
      savedToPcFolder?: boolean;
      targetFolderPath?: string;
      saveFallbackReason?: string;
    }> = [];
    const errors: Array<{ label: string; reason: string }> = [];

    for (const { item, volumes } of targetItems) {
      if (batchAbortRef.current) break;

      const effectiveFormat = (settings.downloadFormat === 'zip' || settings.downloadFormat === 'cbz')
        ? settings.downloadFormat
        : 'rar';

      // 記憶しているフォルダ一覧から最適な保存先サブフォルダを解決
      const optimalFolder = findBestTargetFolder({
        mangaTitle: item.mangaTitle,
        item,
        scannedItems: items,
        rememberedFolders,
        rootName: rememberedRootName || activeRootHandle?.name || 'Manga',
        rootDisplayPath: currentPath,
      });

      let targetDirHandle: any = null;
      let folderResolveError: string | undefined;
      if (canWriteToRoot && activeRootHandle) {
        if (optimalFolder.directoryHandle) {
          try {
            const p = await optimalFolder.directoryHandle.queryPermission?.({ mode: 'readwrite' });
            if (p === 'granted') {
              targetDirHandle = optimalFolder.directoryHandle;
            }
          } catch {}
        }
        if (!targetDirHandle && optimalFolder.subFolderPath) {
          targetDirHandle = await resolveOrCreateSubfolder(activeRootHandle, optimalFolder.subFolderPath);
          if (!targetDirHandle) {
            folderResolveError = `サブフォルダ (${optimalFolder.subFolderPath}) の取得・作成に失敗しました`;
          }
        }
        if (!targetDirHandle && !optimalFolder.subFolderPath) {
          targetDirHandle = activeRootHandle;
        }
      }

      for (const vol of volumes) {
        if (batchAbortRef.current) break;

        const volNum = vol.volume;
        const initialFileName = `${item.mangaTitle} 第${String(volNum).padStart(2, '0')}巻.${effectiveFormat}`;
        const logId = `dl-${Date.now()}-${overallIndex}-${volNum}`;
        const preferredLink =
          settings.preferredHost !== 'all'
            ? vol.downloadLinks?.find((l) => l.host === settings.preferredHost)
            : undefined;
        const targetDownloadUrl = vol.downloadUrl || preferredLink?.url || vol.downloadLinks?.[0]?.url || '';
        const targetDisplayDestination = buildFullDisplayPath(currentPath, optimalFolder.subFolderPath, initialFileName);

        const volumeExpectedSize =
          item.files && item.files[0]?.size && item.files[0].size > 1000000
            ? item.files[0].size
            : 38 * 1024 * 1024;

        addDownloadLog({
          id: logId,
          timestamp: new Date().toLocaleTimeString(),
          title: item.mangaTitle,
          volume: volNum,
          fileName: initialFileName,
          status: 'downloading',
          savedToPcFolder: false,
          destination: targetDirHandle ? targetDisplayDestination : '個別ブラウザDL (.rar)',
          message: targetDirHandle
            ? `[Pass 1/2] 取得中 → 保存先: ${optimalFolder.subFolderPath}`
            : '[Pass 1/2] Webアプリ内へ原本を取得中...',
          downloadUrl: targetDownloadUrl,
        });

        setStreamProgress((prev) => ({
          ...prev,
          status: 'downloading',
          phase: 'pass1',
          currentTitle: item.mangaTitle,
          currentVolume: volNum,
          currentIndex: overallIndex,
          receivedBytes: 0,
          totalBytes: volumeExpectedSize,
          speedMb: '0.00',
          currentStep: `[Pass 1/2] 第${volNum}巻をWebアプリ内へダウンロード中...`,
        }));

        try {
          // 【Pass 1】この1冊の原本をWebアプリ内キャッシュへ取得
          const p1Result = await downloadPass1ToWebAppCache(
            {
              title: item.mangaTitle,
              volume: volNum,
              downloadUrl: targetDownloadUrl,
              format: effectiveFormat,
              size: volumeExpectedSize,
              debridApiKey: settings.debridApiKey,
            },
            (info) => {
              setStreamProgress((prev) => ({
                ...prev,
                receivedBytes: info.downloadedBytes,
                totalBytes: info.totalBytes,
                speedMb: info.speedMb,
                currentStep:
                  info.status === 'resolving'
                    ? `[Pass 1/2] アップローダー直リンクを解決中...`
                    : `[Pass 1/2] 第${volNum}巻を取得中 (${(info.downloadedBytes / (1024 * 1024)).toFixed(1)}MB / ${(info.totalBytes / (1024 * 1024)).toFixed(1)}MB ・ ${info.speedMb}MB/s)`,
              }));
            }
          );

          if (batchAbortRef.current) {
            await releaseWebAppCacheJob(p1Result.jobId);
            break;
          }

          // 【Pass 2】最適フォルダへ直接書き込み保存（ハンドル未接続時はブラウザDL保存へフォールバック）
          setStreamProgress((prev) => ({
            ...prev,
            phase: 'pass2',
            receivedBytes: 0,
            totalBytes: p1Result.size,
            speedMb: undefined,
            currentStep: targetDirHandle
              ? `[Pass 2/2] 最適フォルダ (${optimalFolder.subFolderPath}) へ保存中...`
              : `[Pass 2/2] ${p1Result.fileName} を15MB分割転送 → ブラウザ保存中...`,
          }));

          const pass2Res = await downloadPass2ToBrowser(
            p1Result.cachedUrl,
            p1Result.fileName,
            {
              autoTriggerBrowserDownload: true,
              isSim: p1Result.isSim,
              targetDirHandle,
              autoRevokeDelayMs: totalCount > 1 ? 10000 : undefined,
            },
            (loaded, total) => {
              setStreamProgress((prev) => ({
                ...prev,
                receivedBytes: loaded,
                totalBytes: total > 0 ? total : p1Result.size,
                currentStep: targetDirHandle
                  ? `[Pass 2/2] ${optimalFolder.subFolderPath} へ転送・書込中 (${(loaded / (1024 * 1024)).toFixed(1)}MB / ${((total || p1Result.size) / (1024 * 1024)).toFixed(1)}MB)...`
                  : `[Pass 2/2] PCへ保存中 (${(loaded / (1024 * 1024)).toFixed(1)}MB / ${((total || p1Result.size) / (1024 * 1024)).toFixed(1)}MB)...`,
              }));
            }
          );

          // 複数冊連続処理時はCloud Run /tmp メモリ圧迫(HTTP 503)を防ぐため即座にサーバー一時ファイルを解放
          if (totalCount > 1) {
            await releaseWebAppCacheJob(p1Result.jobId);
          }

          const finalDest = pass2Res.savedToPcFolder
            ? buildFullDisplayPath(currentPath, optimalFolder.subFolderPath, pass2Res.fileName)
            : 'ブラウザのダウンロードフォルダ';
          const effectiveFallbackReason = pass2Res.savedToPcFolder
            ? undefined
            : (pass2Res.saveFallbackReason || folderResolveError || directSaveNote);

          const doneEntry = {
            itemId: item.id,
            jobId: p1Result.jobId,
            title: item.mangaTitle,
            volume: volNum,
            fileName: pass2Res.fileName,
            size: pass2Res.size,
            blobUrl: pass2Res.blobUrl,
            cachedUrl: p1Result.cachedUrl,
            downloadUrl: targetDownloadUrl,
            isSim: p1Result.isSim,
            savedToPcFolder: pass2Res.savedToPcFolder,
            targetFolderPath: finalDest,
            saveFallbackReason: effectiveFallbackReason,
          };
          completedList.push(doneEntry);

          updateDownloadLog(logId, {
            status: 'success',
            size: pass2Res.size,
            savedToPcFolder: pass2Res.savedToPcFolder,
            destination: finalDest,
            message: pass2Res.savedToPcFolder
              ? `最適フォルダへ直接保存完了: ${optimalFolder.subFolderPath} (${(pass2Res.size / (1024 * 1024)).toFixed(1)}MB)`
              : effectiveFallbackReason
                ? `ブラウザ保存完了 (${effectiveFallbackReason})`
                : `2パス個別保存完了 (${(pass2Res.size / (1024 * 1024)).toFixed(1)}MB)`,
          });

          // 新しいサブフォルダを作成した場合は記憶フォルダリストにも追加
          if (pass2Res.savedToPcFolder && !rememberedFolders.some((f) => f.subFolderPath === optimalFolder.subFolderPath)) {
            const newFolderRecord: ScannedFolderRecord = {
              folderName: optimalFolder.folderName,
              mangaTitle: item.mangaTitle,
              categoryFolder: optimalFolder.categoryFolder,
              subFolderPath: optimalFolder.subFolderPath,
              directoryHandle: targetDirHandle,
            };
            setRememberedFolders((prev) => {
              const nextFolders = [...prev, newFolderRecord];
              saveRememberedFolderState({
                rootName: rememberedRootName || activeRootHandle?.name || 'Manga',
                displayPath: currentPath,
                sourceMode: 'fs_api',
                scannedAt: new Date().toISOString(),
                scannedFolders: nextFolders,
              });
              return nextFolders;
            });
          }

          // この1冊分の所持巻数を即時更新
          setItems((prev) => {
            const updatedItems: LocalMangaItem[] = prev.map((i): LocalMangaItem => {
              if (i.id !== item.id) return i;
              const updatedOwned = Array.from(new Set([...i.ownedVolumes, volNum])).sort((a, b) => a - b);
              const remainingNew = i.availableNewVolumes.filter((v) => v.volume !== volNum);
              const newMax = Math.max(i.maxVolume, volNum);
              return {
                ...i,
                subFolderPath: i.subFolderPath || optimalFolder.subFolderPath,
                directoryHandle: i.directoryHandle || targetDirHandle || undefined,
                ownedVolumes: updatedOwned,
                maxVolume: newMax,
                availableNewVolumes: remainingNew,
                status: remainingNew.length > 0 ? 'has_updates' : 'up_to_date',
                files: [...i.files, { name: pass2Res.fileName, volume: volNum, size: pass2Res.size }],
              };
            });
            saveRememberedScannedItems(updatedItems);
            return updatedItems;
          });

          setStreamProgress((prev) => ({
            ...prev,
            completedList: [...completedList],
          }));

          // 次の巻がある場合はブラウザ連続DLの発火安定化のためわずかに待機
          if (overallIndex < totalCount - 1 && !batchAbortRef.current) {
            await new Promise((r) => setTimeout(r, 600));
          }
        } catch (err: any) {
          const reason = err?.message || 'ダウンロード失敗';
          console.error(`2-pass download error: ${item.mangaTitle} vol ${volNum}:`, err);
          errors.push({ label: `${item.mangaTitle} 第${volNum}巻`, reason });
          updateDownloadLog(logId, {
            status: 'failed',
            error: reason,
            message: `取得失敗: ${reason}`,
          });
          setStreamProgress((prev) => ({
            ...prev,
            errors: [...errors],
          }));
        }

        overallIndex++;
      }
    }

    const wasAborted = batchAbortRef.current;

    if (completedList.length === 0) {
      const combinedError =
        errors.map((e) => `${e.label}: ${e.reason}`).join('\n') ||
        (wasAborted ? 'ダウンロードが中止されました' : 'ダウンロードに失敗しました');
      setStreamProgress((prev) => ({
        ...prev,
        status: 'error',
        aborted: wasAborted,
        errors,
        errorMessage: combinedError,
        currentStep: wasAborted ? 'ダウンロード中止' : 'ダウンロード失敗',
      }));
      showToast(
        wasAborted ? 'ダウンロードを中止しました' : `ダウンロード失敗: ${errors[0]?.reason || 'エラー'}`,
        wasAborted ? 'info' : 'error'
      );
      return;
    }

    const savedFolderCount = completedList.filter((c) => c.savedToPcFolder).length;

    setStreamProgress((prev) => ({
      ...prev,
      status: 'completed',
      aborted: wasAborted,
      completedList,
      errors,
      currentStep: wasAborted
        ? `中止 (${completedList.length}冊は保存完了)`
        : savedFolderCount === completedList.length
          ? `全${completedList.length}冊を最適フォルダへ直接保存完了`
          : `全${completedList.length}冊の保存が完了`,
    }));

    showToast(
      wasAborted
        ? `中止までに ${completedList.length}冊を保存しました`
        : savedFolderCount > 0
          ? `新刊 ${savedFolderCount}冊を記憶中の最適フォルダ以下へ保存しました！`
          : `新刊 ${completedList.length}冊の個別ブラウザ保存が完了しました！`,
      errors.length > 0 || wasAborted ? 'info' : 'success'
    );
  };

  // 完了モーダル内の個別ファイル再保存ハンドラ
  const handleSaveSingleCachedToBrowser = async (entry: {
    itemId: string;
    jobId: string;
    title: string;
    volume: number;
    fileName: string;
    blobUrl?: string;
    cachedUrl: string;
    downloadUrl?: string;
    isSim?: boolean;
  }) => {
    if (entry.blobUrl) {
      triggerBrowserSaveFromBlobUrl(entry.blobUrl, entry.fileName);
      showToast(`${entry.fileName} のブラウザ保存を開始しました`, 'info');
      return;
    }
    const targetItem = items.find((i) => i.id === entry.itemId) || ({
      id: entry.itemId,
      folderName: entry.title,
      mangaTitle: entry.title,
      categoryFolder: 'manga 1st',
      subFolderPath: `manga 1st/${entry.title}`,
      ownedVolumes: [],
      maxVolume: Math.max(0, entry.volume - 1),
      files: [],
      status: 'has_updates',
      availableNewVolumes: [],
    } as LocalMangaItem);

    await executeDownloadBatch([
      {
        item: targetItem,
        volumes: [
          {
            volume: entry.volume,
            title: `${entry.title} 第${entry.volume}巻`,
            source: '再ダウンロード',
            downloadUrl: entry.downloadUrl,
            selected: true,
          },
        ],
      },
    ]);
  };

  const handleDownloadAndSaveToFolder = async (
    targetItem: LocalMangaItem,
    selectedVolumes: NewVolumeInfo[]
  ) => {
    setSelectedMangaForModal(null);
    await executeDownloadBatch([{ item: targetItem, volumes: selectedVolumes }], { forceBrowserOnly: false });
  };

  const handleBrowserDownloadOnly = async (
    targetItem: LocalMangaItem,
    selectedVolumes: NewVolumeInfo[]
  ) => {
    setSelectedMangaForModal(null);
    await executeDownloadBatch([{ item: targetItem, volumes: selectedVolumes }], { forceBrowserOnly: true });
  };

  const handleDownloadAllNewReleases = async () => {
    const itemsWithUpdates = items.filter((i) => i.availableNewVolumes.length > 0);
    if (itemsWithUpdates.length === 0) {
      showToast('ダウンロード対象の新刊が見つかりません', 'info');
      return;
    }
    const targets = itemsWithUpdates.map((i) => ({ item: i, volumes: i.availableNewVolumes }));
    await executeDownloadBatch(targets);
  };

  const handleImportAndSave = async (
    targetItem: LocalMangaItem,
    volumes: Array<{ volume: number; url: string; host: string }>
  ) => {
    setIsImportModalOpen(false);
    const mappedVolumes: NewVolumeInfo[] = volumes.map((v) => ({
      volume: v.volume,
      title: `${targetItem.mangaTitle} 第${v.volume}巻`,
      source: 'URL直接取り込み',
      downloadUrl: v.url,
      selected: true,
      downloadLinks: [{ host: v.host || 'direct', url: v.url, label: (v.host || 'DIRECT').toUpperCase() }],
    }));
    await executeDownloadBatch([{ item: targetItem, volumes: mappedVolumes }]);
  };

  const handleImportDownloadedRarFiles = async (files: FileList) => {
    const fileList = Array.from(files);
    if (fileList.length === 0) return;

    if (!rootDirectoryHandle) {
      showToast('原本RARをPCフォルダへ保存するため、まず「PCフォルダ同期 (M:\\)」で保存先フォルダを選択してください', 'error');
      return;
    }

    const granted = await ensureDirectoryPermission(rootDirectoryHandle);
    if (!granted) {
      showToast('フォルダへの書き込み権限が拒否されました', 'error');
      return;
    }

    let successCount = 0;
    for (const file of fileList) {
      const isManga = /\.(rar|cbz|zip|cbr)$/i.test(file.name);
      if (!isManga) continue;

      const { title } = parseMangaFilename(file.name);
      const effectiveTitle = title || file.name.replace(/\.[^.]+$/, '');

      const optimal = findBestTargetFolder({
        mangaTitle: effectiveTitle,
        scannedItems: items,
        rememberedFolders,
        rootName: rememberedRootName || rootDirectoryHandle.name || 'Manga',
        rootDisplayPath: currentPath,
      });

      try {
        const dir = optimal.directoryHandle || (await resolveOrCreateSubfolder(rootDirectoryHandle, optimal.subFolderPath));
        if (dir) {
          await copyLocalFileChunked(dir, file, file.name);
          successCount++;
        }
      } catch (err: any) {
        console.error('Import rar error:', err);
      }
    }

    if (successCount > 0) {
      showToast(`ダウンロード済みの原本RARファイル (${successCount}冊) を記憶した最適フォルダへ自動配置しました！`, 'success');
      await handleRescanRememberedDirectory();
    } else {
      showToast('対応するマンガファイル（.rar, .zip等）が見つかりませんでした', 'info');
    }
  };

  const totalTitles = items.length;
  const totalFiles = items.reduce((acc, i) => acc + i.files.length, 0);
  const totalNewReleases = items.reduce((acc, i) => acc + i.availableNewVolumes.length, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* 2パス分割ダウンロード進行中 / 完了 / エラーモーダル */}
      {streamProgress.isActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className={`bg-slate-900 border ${streamProgress.status === 'error' ? 'border-rose-500/60' : 'border-indigo-500/50'} rounded-2xl p-6 w-full max-w-lg shadow-2xl space-y-4`}>
            {/* ダウンロード進行中画面 */}
            {streamProgress.status === 'downloading' && (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center animate-pulse shrink-0">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                          streamProgress.phase === 'pass1'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                            : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                        }`}>
                          {streamProgress.phase === 'pass1' ? 'Pass 1/2: Webアプリ内DL' : 'Pass 2/2: 個別RAR保存'}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono">
                          {streamProgress.currentIndex + 1} / {streamProgress.totalCount} 冊目
                        </span>
                        {streamProgress.completedList.length > 0 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                            保存済 {streamProgress.completedList.length}冊
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-white truncate mt-1">
                        {streamProgress.currentTitle}
                        {streamProgress.currentVolume > 0 ? ` 第${streamProgress.currentVolume}巻` : ''}
                      </h3>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      batchAbortRef.current = true;
                      showToast('現在のファイル完了後に処理を中止します...', 'info');
                    }}
                    className="text-rose-300 hover:text-white px-2.5 py-1 rounded-lg bg-rose-950/50 hover:bg-rose-600 border border-rose-500/40 transition text-xs font-semibold shrink-0"
                  >
                    中止
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-slate-300 truncate max-w-[320px]">{streamProgress.currentStep}</span>
                    <span className="text-cyan-300 font-bold shrink-0">
                      {streamProgress.totalBytes > 0
                        ? `${Math.min(100, Math.round((streamProgress.receivedBytes / streamProgress.totalBytes) * 100))}%`
                        : '処理中...'}
                    </span>
                  </div>

                  {/* プログレスバー */}
                  <div className="w-full h-3.5 rounded-full bg-slate-950 border border-slate-800 overflow-hidden p-0.5">
                    <div
                      className={`h-full rounded-full transition-all duration-150 ${
                        streamProgress.phase === 'pass1'
                          ? 'bg-gradient-to-r from-amber-500 via-indigo-500 to-cyan-400'
                          : 'bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400'
                      }`}
                      style={{
                        width: `${streamProgress.totalBytes > 0 ? Math.min(100, Math.round((streamProgress.receivedBytes / streamProgress.totalBytes) * 100)) : 10}%`,
                      }}
                    />
                  </div>

                  <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                    <span>受信済: {(streamProgress.receivedBytes / (1024 * 1024)).toFixed(1)} MB</span>
                    <span>
                      {streamProgress.speedMb ? `${streamProgress.speedMb} MB/s・` : ''}
                      サイズ目安: {(streamProgress.totalBytes / (1024 * 1024)).toFixed(1)} MB
                    </span>
                  </div>
                </div>

                {/* ブラウザDLフォールバック理由の案内 */}
                {streamProgress.directSaveNote && (
                  <div className="bg-amber-950/30 border border-amber-500/30 rounded-lg px-3 py-2 text-[11px] text-amber-200 leading-relaxed">
                    {streamProgress.directSaveNote}
                  </div>
                )}

                {/* すでに個別保存が完了したファイル一覧（リアルタイム表示） */}
                {streamProgress.completedList.length > 0 && (
                  <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5 space-y-1 max-h-32 overflow-y-auto">
                    <div className="text-[10px] font-semibold text-emerald-400">
                      {streamProgress.completedList.some((c) => c.savedToPcFolder)
                        ? '保存済みファイル (最適フォルダ直接保存済):'
                        : '保存済みファイル (PCへブラウザDL済):'}
                    </div>
                    {streamProgress.completedList.map((c, idx) => (
                      <div key={idx} className="text-[11px] text-slate-300 flex items-center justify-between gap-2 font-mono">
                        <span className="truncate flex items-center gap-1.5">
                          <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                          <span className="truncate">{c.fileName}</span>
                        </span>
                        <span className="text-emerald-400 shrink-0">
                          {(c.size / (1024 * 1024)).toFixed(1)} MB
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
                  <span>※ 大容量対策のためZIPにせず1冊ずつ .rar 毎に順次PCへ保存します</span>
                  <span className="font-mono text-cyan-400 shrink-0">
                    全 {streamProgress.totalCount}冊
                  </span>
                </div>
              </>
            )}

            {/* ダウンロードエラー画面 */}
            {streamProgress.status === 'error' && (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-rose-200">
                        ダウンロードに失敗しました
                      </h3>
                      <p className="text-xs text-rose-300/80">
                        {streamProgress.currentStep || '実体データの取得・転送が完了できませんでした'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={closeStreamProgressModal}
                    className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="bg-rose-950/40 border border-rose-500/40 rounded-xl p-3.5 space-y-2 max-h-52 overflow-y-auto">
                  {streamProgress.errors.length > 0 ? (
                    streamProgress.errors.map((err, i) => (
                      <div key={i} className="text-xs text-rose-200 border-b border-rose-500/20 last:border-b-0 pb-1.5 last:pb-0">
                        <div className="font-bold text-rose-300">{err.label}</div>
                        <div className="text-[11px] text-rose-200/90 break-all">{err.reason}</div>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-rose-200 whitespace-pre-wrap break-all">
                      {streamProgress.errorMessage || '外部アップローダーからのデータ取得に失敗しました。'}
                    </div>
                  )}
                </div>

                <div className="text-[11px] text-slate-400 bg-slate-950/70 border border-slate-800 rounded-lg p-2.5 leading-relaxed">
                  外部アップローダー（Leechtop / PubgFile 等）の1時間1回制限やホスト側エラーの場合、時間をおいて再試行するか、詳細モーダルから別リンク（Rapidgator / Katfile 等）や設定のDebridキーをご確認下さい。
                </div>

                <div className="pt-2 border-t border-slate-800 flex justify-end">
                  <button
                    type="button"
                    onClick={closeStreamProgressModal}
                    className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition"
                  >
                    閉じる
                  </button>
                </div>
              </>
            )}

            {/* ダウンロード完了画面 */}
            {streamProgress.status === 'completed' && (() => {
              const savedToPcCount = streamProgress.completedList.filter((c) => c.savedToPcFolder).length;
              const allSavedToPc = savedToPcCount > 0 && savedToPcCount === streamProgress.completedList.length;
              return (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">
                        {streamProgress.aborted
                          ? `新刊 ${streamProgress.completedList.length}冊の保存が完了しました (途中中止)`
                          : allSavedToPc
                            ? `新刊 ${savedToPcCount}冊を最適フォルダへ直接保存しました！`
                            : savedToPcCount > 0
                              ? `新刊 ${streamProgress.completedList.length}冊の保存が完了しました（うち${savedToPcCount}冊は最適フォルダ直接保存）`
                              : `新刊 ${streamProgress.completedList.length}冊の個別ブラウザ保存が完了しました！`}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {allSavedToPc
                          ? '1冊ずつWebアプリ内で取得し、記憶している最適サブフォルダ配下へ直接書き込みました'
                          : '1冊ずつWebアプリ内で取得し、個別の .rar ファイルとしてPCへ保存しました'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={closeStreamProgressModal}
                    className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* 直接保存できなかった場合の明確な理由表示 */}
                {!allSavedToPc && streamProgress.directSaveNote && (
                  <div className="bg-amber-950/30 border border-amber-500/40 rounded-xl p-3 text-xs text-amber-200 leading-relaxed">
                    <span className="font-bold text-amber-300">ブラウザDLが選択された理由: </span>
                    {streamProgress.directSaveNote}
                  </div>
                )}

                {/* 一部エラーがあった場合の警告 */}
                {streamProgress.errors.length > 0 && (
                  <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-3 text-xs space-y-1 max-h-28 overflow-y-auto">
                    <div className="font-bold text-amber-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>一部 ({streamProgress.errors.length}冊) は取得に失敗しました:</span>
                    </div>
                    {streamProgress.errors.map((err, i) => (
                      <div key={i} className="text-[11px] text-amber-200/90">
                        ・{err.label}: {err.reason}
                      </div>
                    ))}
                  </div>
                )}

                {/* 保存済みファイルリスト */}
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {streamProgress.completedList.map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="font-bold text-white truncate flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="truncate">{item.fileName}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 font-mono">
                          <span className={item.size >= 1024 * 1024 || item.isSim ? "text-emerald-400 font-semibold" : "text-amber-400 font-semibold"}>
                            {item.size >= 1024 * 1024
                              ? `${(item.size / (1024 * 1024)).toFixed(1)} MB`
                              : `${(item.size / 1024).toFixed(1)} KB`}
                          </span>
                          <span className="text-slate-600">|</span>
                          <span className="truncate text-cyan-300" title={item.targetFolderPath || ''}>
                            {item.savedToPcFolder
                              ? `最適フォルダ保存済: ${item.targetFolderPath || 'PCフォルダ'}`
                              : `個別ブラウザ保存済${item.saveFallbackReason ? ` (${item.saveFallbackReason})` : ''}`}
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleSaveSingleCachedToBrowser(item)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 text-xs font-semibold transition"
                          title="このファイルを再度2パス保存"
                        >
                          <Download className="w-3.5 h-3.5 text-cyan-400" />
                          <span>再保存</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    {savedToPcCount > 0
                      ? '※ 記憶したフォルダ構成の最適サブフォルダ以下に直接保存されました'
                      : '※ ブラウザの「ダウンロード」フォルダに個別の .rar として保存されました'}
                  </span>
                  <button
                    type="button"
                    onClick={closeStreamProgressModal}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition"
                  >
                    完了して閉じる
                  </button>
                </div>
              </>
              );
            })()}
          </div>
        </div>
      )}

      {/* トースト通知 */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-slate-900 border border-indigo-500/50 shadow-2xl animate-in slide-in-from-bottom duration-200">
          {toastMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          {toastMessage.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400" />}
          {toastMessage.type === 'info' && <Sparkles className="w-4 h-4 text-cyan-400" />}
          <span className="text-xs font-medium text-slate-200">{toastMessage.message}</span>
        </div>
      )}

      {/* ヘッダー */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25">
              <FolderSync className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base text-white tracking-tight">AutoMangaUpdate2</h1>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  v0.2.0
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  DL-RAW.SI 連携版
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  実データ分割保存
                </span>
              </div>
              <p className="text-xs text-slate-400">
                M:\MangaS\Manga 自動スキャン ＆ 2パスWeb分割DL・ブラウザ保存
              </p>
            </div>
          </div>

          {/* ナビゲーションタブ */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('local_sync')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'local_sync'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>ローカルマンガ更新</span>
              {totalNewReleases > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950 text-[10px] font-bold">
                  {totalNewReleases}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('dl_raw_db')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'dl_raw_db'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>DL-RAW クローラーDB</span>
              {totalDbCount > 0 && (
                <span className="text-[10px] text-indigo-300 font-mono">
                  ({totalDbCount})
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('playground')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'playground'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>解析Playground</span>
            </button>
          </div>

          {/* 右上ユーティリティ */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
              title="外部URL（Katfile/Rapidgator等）を直接貼り付けて一括取り込み"
            >
              <Link2 className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">URL直接取り込み</span>
            </button>

            <button
              onClick={() => setIsScriptModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
              title="Windows用ローカル同期スクリプトをダウンロード"
            >
              <Terminal className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">同期スクリプト</span>
            </button>

            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
              title="設定"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 space-y-6">
        {/* TAB 1: ローカルマンガ更新マネージャー (M:\MangaS\Manga) */}
        {activeTab === 'local_sync' && (
          <div className="space-y-6">
            {/* 説明カード */}
            {showClarificationCard && (
              <div className="bg-gradient-to-r from-indigo-950/60 via-slate-900 to-cyan-950/40 border border-indigo-500/30 rounded-2xl p-4 sm:p-5 relative overflow-hidden shadow-lg">
                <button
                  onClick={() => setShowClarificationCard(false)}
                  className="absolute top-3 right-3 text-slate-500 hover:text-slate-300 p-1"
                >
                  ✕
                </button>
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 shrink-0 mt-0.5">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2">
                      <h2 className="font-bold text-sm text-white">AutoMangaUpdate2 の動作仕様 (2パス分割DL方式)</h2>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold text-[10px]">
                        Webアプリ内DL → ブラウザ保存
                      </span>
                    </div>
                    <p className="text-slate-300 leading-relaxed">
                      １．<strong>M:\MangaS\Manga\</strong> 以下の <code>manga 1st\"MangaTitle"\"hogehoge 第xx巻.cbz"</code> をスキャン<br/>
                      ２．各ファイルの <strong>マンガタイトル (hogehoge)</strong> と <strong>最大巻数 (xx)</strong> を自動解析し、DL-RAWから新刊を抽出<br/>
                      ３．<strong>【Pass 1】</strong> Webアプリ内部で原本（数十MBの <code>.rar</code>）を1冊ずつ分割取得してキャッシュ<br/>
                      ４．<strong>【Pass 2】</strong> キャッシュから15MB分割転送し、ZIP化せず <code>.rar</code> ファイル毎にブラウザのDL機能でPCへ個別保存
                    </p>
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <button
                        onClick={() => setIsImportModalOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        <span>DLリンクを直接貼り付けて一括保存</span>
                      </button>
                      <button
                        onClick={() => setIsSettingsOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition"
                      >
                        <span>保存形式（rar / zip / cbz）を設定</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* フォルダ選択＆統計コントロール */}
            <FolderScanner
              currentPath={currentPath}
              rememberedRootName={rememberedRootName}
              rememberedFolderCount={rememberedFolders.length}
              hasDirectoryHandle={Boolean(rootDirectoryHandle)}
              totalTitles={totalTitles}
              totalFiles={totalFiles}
              newReleasesCount={totalNewReleases}
              isScanning={isScanning}
              onPickDirectory={handlePickDirectory}
              onRescanRemembered={handleRescanRememberedDirectory}
              onClearFolderMemory={handleClearFolderMemory}
              onLoadSampleData={handleLoadSampleData}
              onManualFilesUpload={handleManualFilesUpload}
              onImportDownloadedRarFiles={handleImportDownloadedRarFiles}
              onCheckAllNewReleases={() => checkNewReleasesForItems(items)}
              onDownloadAllNewReleases={handleDownloadAllNewReleases}
              isCheckingNewReleases={isCheckingNewReleases}
              onManualPathChange={handleManualPathChange}
            />

            {/* マンガ一覧テーブル */}
            <MangaTable
              items={items}
              onCheckSingle={handleCheckSingle}
              onDownloadNewVolume={(item, vol) => handleDownloadAndSaveToFolder(item, [vol])}
              onOpenVolumeModal={(item) => setSelectedMangaForModal(item)}
            />

            {/* ダウンロード実行ログ＆成否・エラー追跡 */}
            <DownloadLogViewer
              logs={downloadLogs}
              onClearLogs={clearDownloadLogs}
            />
          </div>
        )}

        {/* TAB 2: DL-RAW.SI 巡回クローラー & 全DB (取り込み連携) */}
        {activeTab === 'dl_raw_db' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <CrawlConsole
                  state={scraperState}
                  checkpoint={checkpoint}
                  previousCheckpoint={previousCheckpoint}
                  activeCategory={activeCategory}
                  onCategoryChange={(newCat) => {
                    setActiveCategory(newCat);
                    fetchCrawlerStatus(newCat);
                  }}
                  onStart={handleStartCrawl}
                  onStop={handleStopCrawl}
                  onReset={handleResetCrawl}
                  onPause={handlePauseCrawl}
                  onResume={handleResumeCrawl}
                  onClearDb={async () => {
                    await fetch('/api/manga/clear', { method: 'DELETE' });
                    setRefreshKey((k) => k + 1);
                    fetchCrawlerStatus();
                  }}
                />
                <LiveLogViewer logs={logs} state={scraperState} onClearLogs={() => setLogs([])} />
              </div>

              <div className="space-y-6">
                <CheckpointCard
                  checkpoint={checkpoint}
                  previousCheckpoint={previousCheckpoint}
                  checkpointHistory={checkpointHistory}
                  activeCategory={activeCategory}
                  onClearCheckpoint={async () => {
                    await fetch(`/api/checkpoint?category=${activeCategory}`, { method: 'DELETE' });
                    fetchCrawlerStatus();
                  }}
                  onRollbackCheckpoint={async () => {
                    await fetch(`/api/checkpoint/rollback?category=${activeCategory}`, { method: 'POST' });
                    fetchCrawlerStatus();
                  }}
                />
              </div>
            </div>

            {/* 全データベーステーブル */}
            <div className="pt-2">
              <DlRawDatabaseTable
                refreshKey={refreshKey}
                onSelectItem={(dbItem) => setSelectedDbManga(dbItem)}
                onExport={handleExport}
                onImportSuccess={() => {
                  setRefreshKey((k) => k + 1);
                  fetchCrawlerStatus();
                }}
                showNotification={showToast}
              />
            </div>
          </div>
        )}

        {/* TAB 3: 解析 Playground */}
        {activeTab === 'playground' && (
          <div className="space-y-6">
            <ParserPlayground />
          </div>
        )}
      </main>

      {/* フッター */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-500">
        <p>AutoMangaUpdate2 &bull; M:\MangaS\Manga 自動更新マネージャー ＆ DL-RAW.SI 取り込み連携</p>
      </footer>

      {/* 新刊ダウンロードモーダル */}
      {selectedMangaForModal && (
        <NewVolumeModal
          item={selectedMangaForModal}
          rootDisplayPath={currentPath}
          hasDirectoryHandle={Boolean(rootDirectoryHandle && settings.autoSaveToFolder)}
          onClose={() => setSelectedMangaForModal(null)}
          onDownloadAndSave={handleDownloadAndSaveToFolder}
          onBrowserDownloadOnly={handleBrowserDownloadOnly}
        />
      )}

      {/* 外部DLリンク取り込みモーダル */}
      {isImportModalOpen && (
        <ImportUrlsModal
          items={items}
          onClose={() => setIsImportModalOpen(false)}
          onImportAndSave={handleImportAndSave}
        />
      )}

      {/* 設定モーダル */}
      {isSettingsOpen && (
        <SettingsModal
          settings={settings}
          onSave={(newSettings) => {
            setSettings(newSettings);
            savePersistedSettings(newSettings);
            setIsSettingsOpen(false);
            showToast('設定を保存しました', 'success');
          }}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

      {/* スクリプトモーダル */}
      {isScriptModalOpen && (
        <ScriptGeneratorModal
          targetPath={settings.expectedPathPrefix}
          onClose={() => setIsScriptModalOpen(false)}
        />
      )}

      {/* DL-RAW DB 詳細モーダル */}
      {selectedDbManga && (
        <DlRawDetailModal
          item={selectedDbManga}
          onClose={() => setSelectedDbManga(null)}
          onSetCheckpoint={(item) => {
            fetch('/api/checkpoint', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: item.title,
                rawTitle: item.latestPostTitle,
                maxVolume: item.maxVolume,
                displayVolume: item.displayVolume,
                url: item.latestUrl,
                page: 1,
                savedAt: new Date().toISOString(),
                category: item.category,
              }),
            }).then(() => {
              showToast(`チェックポイントに設定しました: ${item.title}`, 'success');
              fetchCrawlerStatus();
            });
          }}
        />
      )}
    </div>
  );
}
