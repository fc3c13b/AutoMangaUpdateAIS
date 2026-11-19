import { LocalMangaItem, MangaFile, ScannedFolderRecord } from '../types';
import { parseMangaFilename, cleanFolderName, formatDownloadedFilename } from './mangaParser';

export interface FileSystemAccessStatus {
  supported: boolean;
  inIframe: boolean;
  isSecureContext: boolean;
  browserHint: string;
  reason?: string;
}

/**
 * File System Access API をサポートしているか判定
 */
export function isFileSystemAccessSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as any).showDirectoryPicker === 'function'
  );
}

/**
 * AI Studio プレビュー等の iframe 内で動作しているか判定
 */
export function isRunningInIframe(): boolean {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch {
    return true;
  }
}

/**
 * ブラウザ環境・iframe・HTTPS等の条件を詳しく診断して返す
 */
export function getFileSystemAccessStatus(): FileSystemAccessStatus {
  if (typeof window === 'undefined') {
    return {
      supported: false,
      inIframe: false,
      isSecureContext: false,
      browserHint: 'Server',
      reason: 'ブラウザ環境ではありません',
    };
  }

  const inIframe = isRunningInIframe();
  const isSecureContext = Boolean(window.isSecureContext);
  const supported = typeof (window as any).showDirectoryPicker === 'function';
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  const isBrave = typeof navigator !== 'undefined' && Boolean((navigator as any).brave);
  const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);

  let browserHint = 'このブラウザ';
  if (/Firefox/i.test(ua)) browserHint = 'Firefox';
  else if (/Safari/i.test(ua) && !/Chrome|Chromium|Edg|OPR/i.test(ua)) browserHint = 'Safari';
  else if (/Edg/i.test(ua)) browserHint = isMobile ? 'モバイル版 Edge' : 'Microsoft Edge';
  else if (/OPR|Opera/i.test(ua)) browserHint = isMobile ? 'モバイル版 Opera' : 'Opera';
  else if (isBrave) browserHint = isMobile ? 'モバイル版 Brave' : 'Brave';
  else if (/Chrome|Chromium/i.test(ua)) browserHint = isMobile ? 'モバイル版 Chrome' : 'Google Chrome';

  let reason: string | undefined;
  if (!supported) {
    if (!isSecureContext) {
      reason = 'HTTPS（またはlocalhost）ではないため、フォルダ直接書き込みAPI（showDirectoryPicker）が無効になっています。';
    } else if (isMobile) {
      reason = `現在の環境（${browserHint}）はPCフォルダ直接書き込みAPIに非対応です。Windows/Mac デスクトップ版の Chrome または Edge で開いてください。`;
    } else if (browserHint === 'Brave') {
      reason = 'Braveブラウザは初期設定で File System Access API（showDirectoryPicker）が無効になっています。brave://flags/#file-system-access-api を Enabled にするか、Chrome / Edge で開いてください。';
    } else if (browserHint === 'Firefox' || browserHint === 'Safari') {
      reason = `${browserHint} はブラウザ仕様上、PCフォルダへの直接書き込みAPI（showDirectoryPicker）に非対応です。PC版の Google Chrome または Microsoft Edge でこのURLを開いてください。`;
    } else {
      reason = `現在のブラウザ環境（${browserHint}）では File System Access API（showDirectoryPicker）が無効または非対応のため、PCフォルダへの直接保存ボタンを使用できません。PCデスクトップ版の Google Chrome / Microsoft Edge で開いてください。`;
    }
  } else if (inIframe) {
    reason = 'プレビュー画面（iframe内）ではブラウザのセキュリティ制限により直接フォルダ保存がブロックされます。「新しいタブで開く」から直接開いてください。';
  }

  return {
    supported,
    inIframe,
    isSecureContext,
    browserHint,
    reason,
  };
}

/**
 * ディレクトリピッカーを開いてフォルダを走査
 */
export async function pickAndScanMangaDirectory(): Promise<{
  mangaList: LocalMangaItem[];
  scannedFolders: ScannedFolderRecord[];
  rootName: string;
  rootHandle: any;
}> {
  const fsStatus = getFileSystemAccessStatus();
  if (!fsStatus.supported) {
    throw new Error(
      fsStatus.reason ||
        'お使いのブラウザはFile System Access APIに対応していません。PC版 Google Chrome または Microsoft Edge をご利用ください。'
    );
  }

  let rootHandle: any;
  try {
    // @ts-ignore
    rootHandle = await window.showDirectoryPicker({
      mode: 'readwrite',
    });
  } catch (err: any) {
    if (err?.name === 'SecurityError') {
      throw new Error(
        'プレビュー画面（iframe内）ではブラウザのセキュリティ制限により直接保存用フォルダを選択できません。「新しいタブで開く」からアプリを直接開いて「PCフォルダ同期 (M:\\)」を実行してください。'
      );
    }
    throw err;
  }

  const { mangaList, scannedFolders } = await scanDirectoryWithFolders(rootHandle, '');
  return {
    mangaList,
    scannedFolders,
    rootName: rootHandle.name,
    rootHandle,
  };
}

/**
 * 再帰的にディレクトリをスキャンし、マンガ一覧と全フォルダ構造の両方を返す
 */
export async function scanDirectoryWithFolders(
  dirHandle: any,
  currentPath: string
): Promise<{ mangaList: LocalMangaItem[]; scannedFolders: ScannedFolderRecord[] }> {
  const mangaItemsMap = new Map<string, LocalMangaItem>();
  const scannedFoldersMap = new Map<string, ScannedFolderRecord>();

  async function traverse(currentHandle: any, pathParts: string[]) {
    if (pathParts.length > 0) {
      const subPath = pathParts.join('/');
      const folderName = pathParts[pathParts.length - 1];
      const category = pathParts.length > 1 ? pathParts[0] : 'default';
      if (!scannedFoldersMap.has(subPath)) {
        scannedFoldersMap.set(subPath, {
          folderName,
          mangaTitle: cleanFolderName(folderName),
          categoryFolder: category,
          subFolderPath: subPath,
          directoryHandle: currentHandle,
        });
      }
    }

    let hasSubDirectory = false;
    let hasArchiveFile = false;

    // @ts-ignore
    for await (const [name, handle] of currentHandle.entries()) {
      if (handle.kind === 'directory') {
        if (name.startsWith('.') || name === 'System Volume Information' || name === '$RECYCLE.BIN') {
          continue;
        }
        hasSubDirectory = true;
        // 次の階層へ
        await traverse(handle, [...pathParts, name]);
      } else if (handle.kind === 'file') {
        const isMangaFile = /\.(cbz|zip|rar|cbr)$/i.test(name);
        if (!isMangaFile) continue;
        hasArchiveFile = true;

        // 階層情報
        // pathParts: 例 ['manga 1st', 'ONE PIECE'] または ['ONE PIECE']
        const category = pathParts.length > 1 ? pathParts[0] : 'default';
        const folderTitle = pathParts.length > 0 ? pathParts[pathParts.length - 1] : 'Unknown';
        
        // ファイル名からタイトルと巻数をパース
        const { title: parsedTitle, volume } = parseMangaFilename(name, folderTitle);
        const effectiveTitle = parsedTitle || cleanFolderName(folderTitle);

        // キーは タイトル または (フォルダパス + タイトル)
        const key = `${category}:::${folderTitle}`;

        const fileObj: MangaFile = {
          name,
          volume,
          size: 0,
          handle,
        };

        try {
          const fileData = await handle.getFile();
          fileObj.size = fileData.size;
          fileObj.lastModified = fileData.lastModified;
        } catch {
          // ignore
        }

        if (!mangaItemsMap.has(key)) {
          mangaItemsMap.set(key, {
            id: key,
            folderName: folderTitle,
            mangaTitle: effectiveTitle,
            categoryFolder: category,
            subFolderPath: pathParts.join('/'),
            ownedVolumes: [volume].filter(v => v > 0),
            maxVolume: volume,
            files: [fileObj],
            directoryHandle: currentHandle, // そのファイルの親ディレクトリハンドル
            status: 'idle',
            availableNewVolumes: [],
          });
        } else {
          const item = mangaItemsMap.get(key)!;
          item.files.push(fileObj);
          if (volume > 0 && !item.ownedVolumes.includes(volume)) {
            item.ownedVolumes.push(volume);
          }
          if (volume > item.maxVolume) {
            item.maxVolume = volume;
          }
          // もし抽出タイトルがより具体的であれば更新
          if (parsedTitle && parsedTitle.length > item.mangaTitle.length) {
            item.mangaTitle = parsedTitle;
          }
        }
      }
    }

    // 末端の作品フォルダにアーカイブ (.cbz/.zip/.rar/.cbr) が無い場合はフォルダ名からタイトル登録（最大巻数=0）
    if (pathParts.length > 0 && !hasSubDirectory && !hasArchiveFile) {
      const category = pathParts.length > 1 ? pathParts[0] : 'default';
      const folderTitle = pathParts[pathParts.length - 1];
      const key = `${category}:::${folderTitle}`;
      if (!mangaItemsMap.has(key)) {
        const cleanedTitle = cleanFolderName(folderTitle) || folderTitle.trim();
        mangaItemsMap.set(key, {
          id: key,
          folderName: folderTitle,
          mangaTitle: cleanedTitle,
          categoryFolder: category,
          subFolderPath: pathParts.join('/'),
          ownedVolumes: [],
          maxVolume: 0,
          files: [],
          directoryHandle: currentHandle,
          status: 'idle',
          availableNewVolumes: [],
        });
      }
    }
  }

  await traverse(dirHandle, currentPath ? [currentPath] : []);

  // ソートして配列で返却
  const result: LocalMangaItem[] = [];
  for (const item of mangaItemsMap.values()) {
    item.ownedVolumes.sort((a, b) => a - b);
    item.files.sort((a, b) => a.volume - b.volume);
    result.push(item);
  }

  // タイトル順でソート
  result.sort((a, b) => a.mangaTitle.localeCompare(b.mangaTitle, 'ja'));

  return {
    mangaList: result,
    scannedFolders: Array.from(scannedFoldersMap.values()),
  };
}

/**
 * 後方互換ラッパー: 再帰的にディレクトリをスキャン
 */
export async function scanDirectoryRecursively(
  dirHandle: any,
  currentPath: string
): Promise<LocalMangaItem[]> {
  const { mangaList } = await scanDirectoryWithFolders(dirHandle, currentPath);
  return mangaList;
}

/**
 * Windows / File System Access API で禁止されている文字を安全な文字へ置換
 */
export function sanitizeFileName(name: string): string {
  return (name || 'manga_file')
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/[\u0000-\u001f]/g, '')
    .replace(/[. ]+$/, '')
    .trim() || 'manga_file';
}

/**
 * 取得したデータをPCのローカルフォルダに直接保存する（チャンク分割ストリーミング対応）
 */
export async function saveFileToDirectory(
  dirHandle: any,
  fileName: string,
  dataBlob: Blob
): Promise<boolean> {
  if (!dirHandle || typeof dirHandle.getFileHandle !== 'function') {
    throw new Error('有効なフォルダハンドルが存在しません。');
  }

  const safeFileName = sanitizeFileName(fileName);

  try {
    if (dirHandle.queryPermission) {
      const currentPerm = await dirHandle.queryPermission({ mode: 'readwrite' });
      if (currentPerm !== 'granted' && dirHandle.requestPermission) {
        const permission = await dirHandle.requestPermission({ mode: 'readwrite' });
        if (permission !== 'granted') {
          throw new Error('フォルダへの書き込み権限が拒否されました。');
        }
      } else if (currentPerm !== 'granted') {
        throw new Error('フォルダへの書き込み権限が許可されていません。');
      }
    } else if (dirHandle.requestPermission) {
      const permission = await dirHandle.requestPermission({ mode: 'readwrite' });
      if (permission !== 'granted') {
        throw new Error('フォルダへの書き込み権限が拒否されました。');
      }
    }

    const fileHandle = await dirHandle.getFileHandle(safeFileName, { create: true });
    const writable = await fileHandle.createWritable();

    const WRITE_CHUNK = 4 * 1024 * 1024;
    if (dataBlob.size > WRITE_CHUNK) {
      let offset = 0;
      while (offset < dataBlob.size) {
        const slice = dataBlob.slice(offset, offset + WRITE_CHUNK);
        const buf = await slice.arrayBuffer();
        await writable.write(buf);
        offset += buf.byteLength;
      }
    } else {
      await writable.write(dataBlob);
    }

    await writable.close();
    return true;
  } catch (error: any) {
    console.error('File save error:', error);
    throw error;
  }
}

/**
 * フォルダの書き込み権限を安全に確認・リクエスト（User Activation考慮）
 */
export async function ensureDirectoryPermission(dirHandle: any): Promise<boolean> {
  if (!dirHandle) return false;
  try {
    if (typeof dirHandle.queryPermission === 'function') {
      const status = await dirHandle.queryPermission({ mode: 'readwrite' });
      if (status === 'granted') return true;
    }
    if (typeof dirHandle.requestPermission === 'function') {
      const req = await dirHandle.requestPermission({ mode: 'readwrite' });
      return req === 'granted';
    }
    return true;
  } catch (e) {
    console.warn('Permission query/request failed:', e);
    return false;
  }
}

/**
 * ルートフォルダから階層（例: "manga 1st/呪術廻戦"）を再帰的に取得または作成
 */
export async function resolveOrCreateSubfolder(rootHandle: any, subFolderPath: string): Promise<any> {
  if (!rootHandle) return null;
  const parts = subFolderPath.split(/[\/\\]/).filter(Boolean);
  let current = rootHandle;
  for (const part of parts) {
    try {
      try {
        current = await current.getDirectoryHandle(part, { create: false });
      } catch {
        const safePart = sanitizeFileName(part);
        current = await current.getDirectoryHandle(safePart, { create: true });
      }
    } catch (e) {
      console.warn(`Failed to resolve or create folder segment: ${part}`, e);
      return null;
    }
  }
  return current;
}

export interface Pass1ProgressInfo {
  downloadedBytes: number;
  totalBytes: number;
  speedMb: string;
  percent: number;
  status: string;
  isStalled?: boolean;
}

export interface Pass1CacheResult {
  jobId: string;
  fileName: string;
  size: number;
  cachedUrl: string;
  isSim: boolean;
}

export interface Pass2BrowserResult {
  fileName: string;
  size: number;
  blobUrl?: string;
  cachedUrl: string;
  savedToPcFolder: boolean;
  saveFallbackReason?: string;
}

/**
 * Webアプリ内のキャッシュファイル（/tmp/dl_cache）を解放する
 */
export async function releaseWebAppCacheJob(jobId: string): Promise<void> {
  if (!jobId) return;
  try {
    await fetch(`/api/download/cached-file?jobId=${encodeURIComponent(jobId)}`, {
      method: 'DELETE',
    });
  } catch {}
}

/**
 * Blob URL からブラウザ標準のダウンロードを実行する（iframe制約に安全な <a>.click() 方式、自動revokeしない）
 */
export function triggerBrowserSaveFromBlobUrl(blobUrl: string, fileName: string): void {
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = fileName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    try {
      document.body.removeChild(a);
    } catch {}
  }, 1000);
}

/**
 * Cloud Run の 32MB レスポンス上限を完全に回避する 15MB チャンク分割 Range ダウンローダー
 */
export async function fetchFileInSafeChunks(
  downloadUrl: string,
  onProgress?: (loaded: number, total: number) => void
): Promise<Blob> {
  let totalSize = 0;
  try {
    const headRes = await fetch(downloadUrl, { method: 'HEAD' });
    if (headRes.ok) {
      totalSize = parseInt(headRes.headers.get('content-length') || '0', 10);
    }
  } catch {}

  const CHUNK_SIZE = 15 * 1024 * 1024; // 15MB チャンク (Cloud Runの32MB上限を確実に下回る)

  if (!totalSize || totalSize <= 20 * 1024 * 1024) {
    const res = await fetch(downloadUrl);
    if (!res.ok) {
      let errText = `サーバーエラー (HTTP ${res.status})`;
      try {
        const errJson = await res.json();
        if (errJson.error) errText = errJson.error;
      } catch {}
      throw new Error(errText);
    }
    const blob = await res.blob();
    if (onProgress) onProgress(blob.size, blob.size);
    return blob;
  }

  // Multi-chunk Range downloading: overcomes Cloud Run 32MB limit completely
  const chunks: Blob[] = [];
  let downloaded = 0;
  while (downloaded < totalSize) {
    const start = downloaded;
    const end = Math.min(start + CHUNK_SIZE - 1, totalSize - 1);
    const chunkRes = await fetch(downloadUrl, {
      headers: {
        'Range': `bytes=${start}-${end}`,
      },
    });
    if (!chunkRes.ok && chunkRes.status !== 206) {
      let errText = `チャンク転送エラー (HTTP ${chunkRes.status})`;
      try {
        const errJson = await chunkRes.json();
        if (errJson.error) errText = errJson.error;
      } catch {}
      throw new Error(errText);
    }
    const chunkBlob = await chunkRes.blob();
    chunks.push(chunkBlob);
    downloaded += chunkBlob.size;
    if (onProgress) onProgress(downloaded, totalSize);
  }

  return new Blob(chunks, { type: 'application/octet-stream' });
}

/**
 * 【Pass 1】Webアプリ内部で原本アーカイブ（.rar等）を外部アップローダーから分割取得し、アプリキャッシュに保存する
 */
export async function downloadPass1ToWebAppCache(
  downloadPayload: {
    title: string;
    volume: number;
    downloadUrl?: string;
    format?: string;
    size?: number;
    debridApiKey?: string;
  },
  onProgress?: (info: Pass1ProgressInfo) => void
): Promise<Pass1CacheResult> {
  const ext = (downloadPayload.format === 'zip' || downloadPayload.format === 'cbz') ? downloadPayload.format : 'rar';
  const finalFileName = `${downloadPayload.title} 第${String(downloadPayload.volume).padStart(2, '0')}巻.${ext}`;
  const isSim = Boolean(downloadPayload.downloadUrl && downloadPayload.downloadUrl.includes('/sim/'));

  const startRes = await fetch('/api/download/server-fetch/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: downloadPayload.downloadUrl || '',
      fileName: finalFileName,
      title: downloadPayload.title,
      volume: downloadPayload.volume,
      format: ext,
      debridApiKey: downloadPayload.debridApiKey,
    }),
  });

  if (!startRes.ok) {
    let errDetail = `HTTP ${startRes.status}`;
    try {
      const errJson = await startRes.json();
      if (errJson.error) errDetail = errJson.error;
    } catch {}
    throw new Error(`Webアプリ内DL開始に失敗しました (${errDetail})`);
  }

  const startData = await startRes.json();
  const jobId: string = startData.jobId;
  const maxWaitMs = Math.max((startData.timeoutSeconds || 180) * 1000 + 15000, 195000);
  const pollStart = Date.now();
  let completed = false;
  let finalBytes = 0;
  let resolvedFileName = finalFileName;

  while (!completed && Date.now() - pollStart < maxWaitMs) {
    await new Promise((r) => setTimeout(r, 500));
    const statusRes = await fetch(`/api/download/server-fetch/status?jobId=${encodeURIComponent(jobId)}`);
    if (!statusRes.ok) {
      if (statusRes.status === 404) {
        throw new Error('ダウンロードジョブが見つかりません（サーバー再起動等の可能性があります）');
      }
      continue;
    }

    const st = await statusRes.json();
    if (st.fileName && typeof st.fileName === 'string' && st.fileName.trim()) {
      resolvedFileName = formatDownloadedFilename(
        st.fileName.trim(),
        downloadPayload.title,
        downloadPayload.volume,
        ext
      );
    }
    const estimatedTotal = st.totalBytes > 0 ? st.totalBytes : (downloadPayload.size || 38 * 1024 * 1024);

    if (onProgress) {
      onProgress({
        downloadedBytes: st.downloadedBytes || 0,
        totalBytes: estimatedTotal,
        speedMb: st.speedMb || '0.00',
        percent: st.percent || 0,
        status: st.status || 'downloading',
        isStalled: st.isStalled,
      });
    }

    if (st.status === 'completed') {
      completed = true;
      finalBytes = st.downloadedBytes || st.totalBytes || 0;
      break;
    } else if (st.status === 'failed') {
      throw new Error(st.error || 'Webアプリ内ダウンロードに失敗しました');
    }
  }

  if (!completed) {
    throw new Error('Webアプリ内ダウンロードがタイムアウトしました');
  }

  if (!isSim && finalBytes < 1024 * 1024) {
    throw new Error(
      `取得サイズが異常に小さすぎます (${(finalBytes / 1024).toFixed(1)} KB)。` +
      `外部アップローダーから原本アーカイブ（通常30MB〜150MB）を取得できませんでした。`
    );
  }

  const cachedUrl = `/api/download/cached-file?jobId=${encodeURIComponent(jobId)}&filename=${encodeURIComponent(resolvedFileName)}`;
  return {
    jobId,
    fileName: resolvedFileName,
    size: finalBytes,
    cachedUrl,
    isSim,
  };
}

/**
 * 【Pass 2】Webアプリ内キャッシュから 15MB HTTP Range チャンク分割転送でブラウザメモリに受信し、
 * ターゲットフォルダハンドルがある場合は最適フォルダへ直接書き込み保存（無い場合はブラウザ標準DLで保存）
 */
export async function downloadPass2ToBrowser(
  cachedUrl: string,
  fileName: string,
  options?: {
    autoTriggerBrowserDownload?: boolean;
    isSim?: boolean;
    autoRevokeDelayMs?: number;
    targetDirHandle?: any;
  },
  onProgress?: (loaded: number, total: number) => void
): Promise<Pass2BrowserResult> {
  const blob = await fetchFileInSafeChunks(cachedUrl, onProgress);

  if (!options?.isSim && blob.size < 1024 * 1024) {
    throw new Error(
      `ブラウザ転送サイズが異常です (${(blob.size / 1024).toFixed(1)} KB)。` +
      `Webアプリキャッシュから実体データを取得できませんでした。`
    );
  }

  let savedToPcFolder = false;
  let saveFallbackReason: string | undefined;

  if (options?.targetDirHandle) {
    try {
      await saveFileToDirectory(options.targetDirHandle, fileName, blob);
      savedToPcFolder = true;
    } catch (err: any) {
      saveFallbackReason = err?.message || 'フォルダ直接保存に失敗したためブラウザDLへフォールバックしました';
      console.warn('Direct folder save failed, falling back to browser download:', err);
    }
  }

  const blobUrl = URL.createObjectURL(blob);
  const shouldTriggerBrowserDl = savedToPcFolder
    ? false
    : options?.autoTriggerBrowserDownload !== false;

  if (shouldTriggerBrowserDl) {
    triggerBrowserSaveFromBlobUrl(blobUrl, fileName);
  }

  if (options?.autoRevokeDelayMs && options.autoRevokeDelayMs > 0) {
    setTimeout(() => {
      try {
        URL.revokeObjectURL(blobUrl);
      } catch {}
    }, options.autoRevokeDelayMs);
  }

  if (onProgress) {
    onProgress(blob.size, blob.size);
  }

  return {
    fileName: savedToPcFolder ? sanitizeFileName(fileName) : fileName,
    size: blob.size,
    blobUrl: options?.autoRevokeDelayMs ? undefined : blobUrl,
    cachedUrl,
    savedToPcFolder,
    saveFallbackReason,
  };
}

/**
 * 単一ファイル向けの 2パスダウンロード統合ヘルパー（Pass 1: Webアプリ内DL → Pass 2: 最適フォルダ保存 or ブラウザDL保存）
 */
export async function streamDownloadAndSaveToDirectory(
  dirHandle: any,
  fileName: string,
  downloadPayload: { title: string; volume: number; downloadUrl?: string; format?: string; size?: number; debridApiKey?: string },
  onProgress?: (receivedBytes: number, totalBytes: number) => void
): Promise<{ fileName: string; size: number; blobUrl?: string; cachedUrl?: string; savedToPcFolder: boolean }> {
  const pass1 = await downloadPass1ToWebAppCache(downloadPayload, (p1) => {
    if (onProgress) {
      onProgress(Math.floor(p1.downloadedBytes * 0.5), p1.totalBytes);
    }
  });

  const pass2 = await downloadPass2ToBrowser(
    pass1.cachedUrl,
    fileName.endsWith(`.${(downloadPayload.format === 'zip' || downloadPayload.format === 'cbz') ? downloadPayload.format : 'rar'}`)
      ? fileName
      : pass1.fileName,
    { autoTriggerBrowserDownload: true, isSim: pass1.isSim, targetDirHandle: dirHandle },
    (loaded, total) => {
      if (onProgress) {
        const half = Math.floor(pass1.size * 0.5);
        const fraction = total > 0 ? loaded / total : 1;
        onProgress(half + Math.floor(half * fraction), pass1.size);
      }
    }
  );

  return {
    fileName: pass2.fileName,
    size: pass2.size,
    blobUrl: pass2.blobUrl,
    cachedUrl: pass2.cachedUrl,
    savedToPcFolder: pass2.savedToPcFolder,
  };
}

/**
 * ローカルPC上の実ファイル（数十MBの .rar / .zip）をチャンク分割ストリーミングで
 * 対象マンガフォルダへコピー・保存
 */
export async function copyLocalFileChunked(
  dirHandle: any,
  file: File,
  targetFileName: string,
  onProgress?: (receivedBytes: number, totalBytes: number) => void
): Promise<number> {
  const safeName = sanitizeFileName(targetFileName);
  const fileHandle = await dirHandle.getFileHandle(safeName, { create: true });
  const writable = await fileHandle.createWritable();

  const chunkSize = 2 * 1024 * 1024; // 2MBごとに分割処理
  let offset = 0;

  while (offset < file.size) {
    const slice = file.slice(offset, offset + chunkSize);
    const buffer = await slice.arrayBuffer();
    await writable.write(buffer);
    offset += buffer.byteLength;
    if (onProgress) {
      onProgress(offset, file.size);
    }
  }

  await writable.close();
  return file.size;
}

/**
 * サンプルデータの生成（動作検証・プレビュー用）
 */
export function getMockSampleMangaList(): LocalMangaItem[] {
  return [
    {
      id: 'manga 1st:::そうだ、売国しよう ～天才王子の赤字国家再生術～',
      folderName: 'そうだ、売国しよう ～天才王子の赤字国家再生術～',
      mangaTitle: 'そうだ、売国しよう ～天才王子の赤字国家再生術～',
      categoryFolder: 'manga 1st',
      subFolderPath: 'manga 1st/そうだ、売国しよう ～天才王子の赤字国家再生術～',
      ownedVolumes: Array.from({ length: 18 }, (_, i) => i + 1),
      maxVolume: 18,
      files: Array.from({ length: 18 }, (_, i) => ({
        name: `そうだ、売国しよう ～天才王子の赤字国家再生術～ 第${String(i + 1).padStart(2, '0')}巻.rar`,
        volume: i + 1,
        size: 38000000,
      })),
      status: 'idle',
      availableNewVolumes: [
        {
          volume: 19,
          title: 'そうだ、売国しよう ～天才王子の赤字国家再生術～ 第19巻',
          source: 'DL-RAW.SI',
          selected: true,
          downloadLinks: [
            { host: 'katfile', url: 'https://katfile.com/sim/SoudaBaikoku_v19.rar', label: 'KATFILE' },
            { host: 'rapidgator', url: 'https://rapidgator.net/file/sim/SoudaBaikoku_v19.rar', label: 'RAPIDGATOR' },
            { host: 'rosefile', url: 'https://rosefile.net/sim/SoudaBaikoku_v19.rar.html', label: 'ROSEFILE' },
          ],
        },
      ],
    },
    {
      id: 'manga 1st:::呪術廻戦',
      folderName: '呪術廻戦',
      mangaTitle: '呪術廻戦',
      categoryFolder: 'manga 1st',
      subFolderPath: 'manga 1st/呪術廻戦',
      ownedVolumes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27],
      maxVolume: 27,
      files: Array.from({ length: 27 }, (_, i) => ({
        name: `呪術廻戦 第${String(i + 1).padStart(2, '0')}巻.rar`,
        volume: i + 1,
        size: 78000000 + (i * 1234567) % 30000000,
      })),
      status: 'idle',
      availableNewVolumes: [],
    },
    {
      id: 'manga 1st:::SPY×FAMILY',
      folderName: 'SPY×FAMILY',
      mangaTitle: 'SPY×FAMILY',
      categoryFolder: 'manga 1st',
      subFolderPath: 'manga 1st/SPY×FAMILY',
      ownedVolumes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
      maxVolume: 13,
      files: Array.from({ length: 13 }, (_, i) => ({
        name: `SPY×FAMILY 第${String(i + 1).padStart(2, '0')}巻.rar`,
        volume: i + 1,
        size: 85000000 + (i * 987654) % 25000000,
      })),
      status: 'idle',
      availableNewVolumes: [],
    },
    {
      id: 'manga 1st:::葬送のフリーレン',
      folderName: '葬送のフリーレン',
      mangaTitle: '葬送のフリーレン',
      categoryFolder: 'manga 1st',
      subFolderPath: 'manga 1st/葬送のフリーレン',
      ownedVolumes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      maxVolume: 12,
      files: Array.from({ length: 12 }, (_, i) => ({
        name: `葬送のフリーレン 第${String(i + 1).padStart(2, '0')}巻.rar`,
        volume: i + 1,
        size: 92000000 + (i * 543210) % 20000000,
      })),
      status: 'idle',
      availableNewVolumes: [],
    },
    {
      id: 'manga 1st:::チェンソーマン',
      folderName: 'チェンソーマン',
      mangaTitle: 'チェンソーマン',
      categoryFolder: 'manga 1st',
      subFolderPath: 'manga 1st/チェンソーマン',
      ownedVolumes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
      maxVolume: 17,
      files: Array.from({ length: 17 }, (_, i) => ({
        name: `チェンソーマン 第${String(i + 1).padStart(2, '0')}巻.rar`,
        volume: i + 1,
        size: 82000000,
      })),
      status: 'idle',
      availableNewVolumes: [],
    },
    {
      id: 'manga 1st:::怪獣8号',
      folderName: '怪獣8号',
      mangaTitle: '怪獣8号',
      categoryFolder: 'manga 1st',
      subFolderPath: 'manga 1st/怪獣8号',
      ownedVolumes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
      maxVolume: 14,
      files: Array.from({ length: 14 }, (_, i) => ({
        name: `怪獣8号 第${String(i + 1).padStart(2, '0')}巻.rar`,
        volume: i + 1,
        size: 91000000,
      })),
      status: 'idle',
      availableNewVolumes: [],
    },
  ];
}
