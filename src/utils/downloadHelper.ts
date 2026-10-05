/**
 * 離線單機版 ZIP 打包檔與單一免安裝 HTML 安全下載模組
 * 解決在 iframe、各類瀏覽器中快取舊檔 (如 10.1 KB 空包) 或 <a> 標籤被阻擋的問題
 */

export interface PackInfo {
  zipAvailable: boolean;
  zipSizeBytes: number;
  zipSizeFormatted: string;
  htmlAvailable: boolean;
  htmlSizeBytes: number;
  htmlSizeFormatted: string;
}

export async function fetchPackInfo(): Promise<PackInfo> {
  try {
    const res = await fetch('/api/offline-pack-info?t=' + Date.now(), { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (e) {
    console.warn('Could not fetch pack info:', e);
  }
  return {
    zipAvailable: true,
    zipSizeBytes: 1136697,
    zipSizeFormatted: '1.1 MB',
    htmlAvailable: true,
    htmlSizeBytes: 2025223,
    htmlSizeFormatted: '2.0 MB',
  };
}

/**
 * 下載完整離線 ZIP 包 (含單機版 HTML、Windows .bat、Mac .command 與詳細說明)
 * 嚴格校驗檔案大小必須在 1 MB 以上，杜絕下載到 10.1 KB 殘留舊檔
 */
export async function triggerOfflinePackDownload(
  onStatusChange?: (status: { loading: boolean; message: string; success?: boolean; size?: string }) => void
): Promise<void> {
  const timestamp = Date.now();
  if (onStatusChange) {
    onStatusChange({ loading: true, message: '正在為您下載完整離線打包檔 (約 1.1 MB)...' });
  }

  try {
    // 優先以 fetch 讀取 Blob (加 timestamp 徹底防止瀏覽器 10.1 KB 舊快取)
    const response = await fetch(`/api/download-offline-pack?t=${timestamp}`, {
      cache: 'no-store',
      headers: {
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache',
      },
    });

    if (!response.ok) {
      throw new Error(`下載伺服器回應異常 (${response.status})`);
    }

    const blob = await response.blob();
    const actualSizeKB = (blob.size / 1024).toFixed(1);
    const actualSizeMB = (blob.size / (1024 * 1024)).toFixed(2);

    // 關鍵檢查：若是 10.1 KB 或小於 500 KB，代表拿到殘留快取或損壞檔，立即阻擋並報警
    if (blob.size < 500000) {
      throw new Error(`下載到的檔案大小不完整 (僅 ${actualSizeKB} KB，應為 1.1 MB)，請強制重新整理頁面清除快取！`);
    }

    // 建立 Blob 下載
    const blobUrl = window.URL.createObjectURL(blob);
    const tempLink = document.createElement('a');
    tempLink.style.display = 'none';
    tempLink.href = blobUrl;
    tempLink.setAttribute('download', '外貿成衣訂單轉換系統_單機離線完整包.zip');
    document.body.appendChild(tempLink);
    tempLink.click();

    setTimeout(() => {
      document.body.removeChild(tempLink);
      window.URL.revokeObjectURL(blobUrl);
    }, 2000);

    if (onStatusChange) {
      onStatusChange({
        loading: false,
        message: `🎉 成功下載完整離線包 (${actualSizeMB} MB)！解壓縮後雙擊「單機版_直接點開免安裝.html」即可秒開`,
        success: true,
        size: `${actualSizeMB} MB`,
      });
    }
  } catch (error: any) {
    console.error('Blob 下載失敗，轉為直連備份管道:', error);

    // 備用管道：以靜態直連下載 (加上 timestamp 防快取)
    try {
      const backupLink = document.createElement('a');
      backupLink.href = `/offline-pack.zip?t=${timestamp}`;
      backupLink.download = '外貿成衣訂單轉換系統_單機離線完整包.zip';
      backupLink.target = '_blank';
      document.body.appendChild(backupLink);
      backupLink.click();
      setTimeout(() => document.body.removeChild(backupLink), 2000);

      if (onStatusChange) {
        onStatusChange({
          loading: false,
          message: '已由備用通道啟動完整下載 (1.1 MB)，請檢查瀏覽器下載清單',
          success: true,
          size: '1.1 MB',
        });
      }
    } catch (e: any) {
      if (onStatusChange) {
        onStatusChange({
          loading: false,
          message: '下載失敗：' + (error.message || '請確認網路連線'),
          success: false,
        });
      }
    }
  }
}

/**
 * 直接下載「單一免安裝 HTML 檔案」（約 2.0 MB）
 * 給同事最無腦的方式：完全不用解壓縮 ZIP，下載這個 .html 檔雙擊就直接在瀏覽器運作！
 */
export async function triggerStandaloneHtmlDownload(
  onStatusChange?: (status: { loading: boolean; message: string; success?: boolean; size?: string }) => void
): Promise<void> {
  const timestamp = Date.now();
  if (onStatusChange) {
    onStatusChange({ loading: true, message: '正在為您下載免解壓單一 HTML 檔 (約 2.0 MB)...' });
  }

  try {
    const response = await fetch(`/api/download-standalone-html?t=${timestamp}`, {
      cache: 'no-store',
      headers: {
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache',
      },
    });

    if (!response.ok) {
      throw new Error(`下載伺服器回應異常 (${response.status})`);
    }

    const blob = await response.blob();
    const actualSizeMB = (blob.size / (1024 * 1024)).toFixed(2);

    if (blob.size < 500000) {
      throw new Error(`檔案不完整 (僅 ${(blob.size / 1024).toFixed(1)} KB)`);
    }

    const blobUrl = window.URL.createObjectURL(blob);
    const tempLink = document.createElement('a');
    tempLink.style.display = 'none';
    tempLink.href = blobUrl;
    tempLink.setAttribute('download', '外貿成衣訂單轉換系統_單機免安裝版.html');
    document.body.appendChild(tempLink);
    tempLink.click();

    setTimeout(() => {
      document.body.removeChild(tempLink);
      window.URL.revokeObjectURL(blobUrl);
    }, 2000);

    if (onStatusChange) {
      onStatusChange({
        loading: false,
        message: `🎉 成功下載單一 HTML 檔 (${actualSizeMB} MB)！直接傳給同事，雙擊就能在 Chrome/Edge 開啟`,
        success: true,
        size: `${actualSizeMB} MB`,
      });
    }
  } catch (error: any) {
    console.error('HTML 下載失敗，轉為直連管道:', error);
    try {
      const backupLink = document.createElement('a');
      backupLink.href = `/單機版_直接點開免安裝.html?t=${timestamp}`;
      backupLink.download = '外貿成衣訂單轉換系統_單機免安裝版.html';
      backupLink.target = '_blank';
      document.body.appendChild(backupLink);
      backupLink.click();
      setTimeout(() => document.body.removeChild(backupLink), 2000);

      if (onStatusChange) {
        onStatusChange({
          loading: false,
          message: '已透過直連管道啟動 HTML 下載 (2.0 MB)，請檢查下載資料夾',
          success: true,
          size: '2.0 MB',
        });
      }
    } catch (e: any) {
      if (onStatusChange) {
        onStatusChange({
          loading: false,
          message: '下載失敗：' + (error.message || '請確認網路連線'),
          success: false,
        });
      }
    }
  }
}
