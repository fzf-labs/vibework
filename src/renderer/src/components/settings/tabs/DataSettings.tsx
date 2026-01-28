/**
 * Data Settings - Export, Import, and Delete Data
 */

import { useEffect, useState } from 'react';
import JSZip from 'jszip';
import type { fs as ElectronFs } from '@/lib/electron-api';
import { getDisplayPath, getVibeworkDataDir } from '@/lib/paths';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/providers/language-provider';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Loader2,
  Trash2,
  Upload,
} from 'lucide-react';

type FsApi = typeof ElectronFs;

interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  children?: FileEntry[];
}

type OperationStatus = 'idle' | 'loading' | 'success' | 'error';

const formatDate = (value: Date): string => value.toISOString().split('T')[0];

const formatDateTime = (value: Date): string => {
  const pad = (num: number) => String(num).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}-${pad(value.getHours())}${pad(value.getMinutes())}${pad(value.getSeconds())}`;
};

const toZipPath = (value: string): string => value.replace(/\\/g, '/');

const trimTrailingSeparators = (value: string): string =>
  value.replace(/[\\/]+$/, '');

const getBaseName = (value: string): string => {
  const trimmed = trimTrailingSeparators(value);
  const lastSlash = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));
  return lastSlash === -1 ? trimmed : trimmed.slice(lastSlash + 1);
};

const getParentDir = (value: string): string => {
  const trimmed = trimTrailingSeparators(value);
  const lastSlash = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));
  return lastSlash === -1 ? trimmed : trimmed.slice(0, lastSlash);
};

const joinPath = (base: string, ...parts: string[]): string => {
  if (!base) return parts.join('/');
  const sep = base.includes('\\') ? '\\' : '/';
  const sanitized = [base, ...parts]
    .filter(Boolean)
    .map((part, index) => {
      if (index === 0) return trimTrailingSeparators(part);
      return part.replace(/^[\\/]+/, '').replace(/[\\/]+$/, '');
    });
  return sanitized.join(sep);
};

const resolvePath = async (targetPath: string): Promise<string> => {
  if (!targetPath) return targetPath;
  if (targetPath.startsWith('~') && window.api?.path?.homeDir) {
    const homeDir = await window.api.path.homeDir();
    return targetPath.replace(/^~(?=\/|\\)/, homeDir);
  }
  return targetPath;
};

const addDirectoryToZip = async (
  zip: JSZip,
  dirPath: string,
  zipPrefix: string,
  fs: FsApi
): Promise<void> => {
  const entries = (await fs.readDir(dirPath, { maxDepth: 1 })) as FileEntry[];

  if (!entries.length) {
    if (zipPrefix) {
      zip.folder(toZipPath(zipPrefix));
    }
    return;
  }

  for (const entry of entries) {
    const entryZipPath = zipPrefix ? `${zipPrefix}/${entry.name}` : entry.name;
    if (entry.isDir) {
      await addDirectoryToZip(zip, entry.path, entryZipPath, fs);
    } else {
      const data = await fs.readFile(entry.path);
      zip.file(toZipPath(entryZipPath), data);
    }
  }
};

const writeZipFromDirectory = async (
  dirPath: string,
  zipPath: string,
  fs: FsApi
): Promise<void> => {
  const zip = new JSZip();
  const rootName = getBaseName(dirPath) || '.vibework';
  await addDirectoryToZip(zip, dirPath, rootName, fs);
  const zipData = await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
  });
  await fs.writeFile(zipPath, zipData);
};

const extractZipToDirectory = async (
  zipData: Uint8Array,
  targetDir: string,
  fs: FsApi
): Promise<void> => {
  const zip = await JSZip.loadAsync(zipData);
  const files = Object.values(zip.files);
  if (!files.length) {
    throw new Error('Invalid zip file');
  }

  const hasRootDir = files.some((file) =>
    toZipPath(file.name).startsWith('.vibework/')
  );
  const stripPrefix = hasRootDir ? '.vibework/' : '';

  for (const file of files) {
    let relativePath = toZipPath(file.name);
    if (stripPrefix && relativePath.startsWith(stripPrefix)) {
      relativePath = relativePath.slice(stripPrefix.length);
    }
    if (!relativePath) continue;
    const parts = relativePath.split('/').filter(Boolean);
    if (!parts.length) continue;
    const targetPath = joinPath(targetDir, ...parts);

    if (file.dir) {
      await fs.mkdir(targetPath);
      continue;
    }

    const parentDir = getParentDir(targetPath);
    if (parentDir) {
      await fs.mkdir(parentDir);
    }
    const data = await file.async('uint8array');
    await fs.writeFile(targetPath, data);
  }
};

export function DataSettings() {
  const { t } = useLanguage();
  const [exportStatus, setExportStatus] = useState<OperationStatus>('idle');
  const [importStatus, setImportStatus] = useState<OperationStatus>('idle');
  const [deleteStatus, setDeleteStatus] = useState<OperationStatus>('idle');
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingImportPath, setPendingImportPath] = useState<string | null>(null);
  const [pendingBackupPath, setPendingBackupPath] = useState<string>('');
  const [pendingBackupDisplayPath, setPendingBackupDisplayPath] =
    useState<string>('');
  const [vibeworkDisplayPath, setVibeworkDisplayPath] = useState('~/.vibework');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    const loadDisplayPath = async () => {
      try {
        const dirPath = await getVibeworkDataDir();
        const resolvedPath = await resolvePath(dirPath);
        const displayPath = await getDisplayPath(resolvedPath);
        setVibeworkDisplayPath(displayPath);
      } catch {
        setVibeworkDisplayPath('~/.vibework');
      }
    };

    loadDisplayPath();
  }, []);

  const getResolvedVibeworkDir = async () => {
    const dirPath = await getVibeworkDataDir();
    return resolvePath(dirPath);
  };

  const buildBackupPath = (vibeworkDir: string) => {
    const parentDir = getParentDir(vibeworkDir);
    return joinPath(
      parentDir,
      `vibework-backup-${formatDateTime(new Date())}.zip`
    );
  };

  const buildExportFilename = () =>
    `vibework-backup-${formatDate(new Date())}.zip`;

  const ensureElectron = () => {
    if (!window.api) {
      throw new Error(t.settings.dataNotSupported || 'Not supported');
    }
  };

  // Export ~/.vibework to zip
  const handleExport = async () => {
    setExportStatus('loading');
    setErrorMessage('');

    try {
      ensureElectron();
      const { dialog, fs } = await import('@/lib/electron-api');
      const vibeworkDir = await getResolvedVibeworkDir();
      const exists = await fs.exists(vibeworkDir);
      if (!exists) {
        throw new Error(
          t.settings.dataDirectoryMissing || 'Data directory not found.'
        );
      }

      const filePath = await dialog.save({
        filters: [{ name: 'Zip', extensions: ['zip'] }],
        defaultPath: buildExportFilename(),
      });

      if (!filePath) {
        setExportStatus('idle');
        return;
      }

      await writeZipFromDirectory(vibeworkDir, filePath, fs as FsApi);
      setExportStatus('success');
      setTimeout(() => setExportStatus('idle'), 2000);
    } catch (error) {
      console.error('[DataSettings] Export failed:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Export failed');
      setExportStatus('error');
      setTimeout(() => setExportStatus('idle'), 3000);
    }
  };

  // Prepare import flow
  const handleImport = async () => {
    setImportStatus('loading');
    setErrorMessage('');

    try {
      ensureElectron();
      const { dialog, fs } = await import('@/lib/electron-api');
      const filePath = await dialog.open({
        filters: [{ name: 'Zip', extensions: ['zip'] }],
        multiple: false,
      });

      if (!filePath) {
        setImportStatus('idle');
        return;
      }

      // Preload zip to validate file exists
      await fs.readFile(filePath as string);

      const vibeworkDir = await getResolvedVibeworkDir();
      const backupPath = buildBackupPath(vibeworkDir);
      const backupDisplayPath = await getDisplayPath(backupPath);

      setPendingImportPath(filePath as string);
      setPendingBackupPath(backupPath);
      setPendingBackupDisplayPath(backupDisplayPath);
      setShowImportConfirm(true);
      setImportStatus('idle');
    } catch (error) {
      console.error('[DataSettings] Import failed:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Import failed');
      setImportStatus('error');
      setTimeout(() => setImportStatus('idle'), 3000);
    }
  };

  const handleConfirmImport = async () => {
    if (!pendingImportPath) return;
    setImportStatus('loading');
    setErrorMessage('');
    setShowImportConfirm(false);

    try {
      ensureElectron();
      const { fs } = await import('@/lib/electron-api');
      const vibeworkDir = await getResolvedVibeworkDir();
      const exists = await fs.exists(vibeworkDir);

      if (exists) {
        await writeZipFromDirectory(vibeworkDir, pendingBackupPath, fs as FsApi);
      }

      if (exists) {
        await fs.remove(vibeworkDir, { recursive: true });
      }
      await fs.mkdir(vibeworkDir);

      const zipData = await fs.readFile(pendingImportPath);
      await extractZipToDirectory(zipData, vibeworkDir, fs as FsApi);

      setImportStatus('success');
      setTimeout(() => {
        setImportStatus('idle');
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error('[DataSettings] Import failed:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Import failed');
      setImportStatus('error');
      setTimeout(() => setImportStatus('idle'), 3000);
    } finally {
      setPendingImportPath(null);
      setPendingBackupPath('');
      setPendingBackupDisplayPath('');
    }
  };

  const handleDelete = async () => {
    setDeleteStatus('loading');
    setErrorMessage('');
    setShowDeleteConfirm(false);

    try {
      ensureElectron();
      const { fs } = await import('@/lib/electron-api');
      const vibeworkDir = await getResolvedVibeworkDir();
      const exists = await fs.exists(vibeworkDir);
      if (exists) {
        await fs.remove(vibeworkDir, { recursive: true });
      }
      setDeleteStatus('success');
      setTimeout(() => {
        setDeleteStatus('idle');
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error('[DataSettings] Delete failed:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Delete failed');
      setDeleteStatus('error');
      setTimeout(() => setDeleteStatus('idle'), 3000);
    }
  };

  const getButtonContent = (
    status: OperationStatus,
    icon: React.ReactNode,
    label: string,
    loadingLabel: string
  ) => {
    if (status === 'loading') {
      return (
        <>
          <Loader2 className="size-4 animate-spin" />
          <span>{loadingLabel}</span>
        </>
      );
    }
    if (status === 'success') {
      return (
        <>
          <CheckCircle2 className="size-4 text-green-500" />
          <span>{t.settings.dataSuccess || 'Success'}</span>
        </>
      );
    }
    return (
      <>
        {icon}
        <span>{label}</span>
      </>
    );
  };

  return (
    <div className="space-y-6">
      {/* Description */}
      <p className="text-muted-foreground text-sm">
        {t.settings.dataDescription ||
          'Manage your data: export backups, import data, or delete data.'}
      </p>

      {/* Export Data */}
      <div className="border-border rounded-lg border p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-foreground font-medium">
              {t.settings.dataExport || 'Export Data'}
            </h3>
            <p className="text-muted-foreground mt-1 text-sm">
              {t.settings.dataExportDescription ||
                'Export ~/.vibework to a zip file.'}
            </p>
          </div>
          <button
            onClick={handleExport}
            disabled={exportStatus === 'loading'}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              'bg-primary text-primary-foreground hover:bg-primary/90',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
          >
            {getButtonContent(
              exportStatus,
              <Download className="size-4" />,
              t.settings.dataExportButton || 'Export',
              t.settings.dataExporting || 'Exporting...'
            )}
          </button>
        </div>
      </div>

      {/* Import Data */}
      <div className="border-border rounded-lg border p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-foreground font-medium">
              {t.settings.dataImport || 'Import Data'}
            </h3>
            <p className="text-muted-foreground mt-1 text-sm">
              {t.settings.dataImportDescription ||
                'Import from a zip file and replace ~/.vibework (backup first).'}
            </p>
          </div>
          <button
            onClick={handleImport}
            disabled={importStatus === 'loading'}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              'border-border text-foreground hover:bg-accent border',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
          >
            {getButtonContent(
              importStatus,
              <Upload className="size-4" />,
              t.settings.dataImportButton || 'Import',
              t.settings.dataImporting || 'Importing...'
            )}
          </button>
        </div>
      </div>

      {/* Delete Data */}
      <div className="border-border rounded-lg border border-red-500/20 bg-red-500/5 p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-foreground font-medium">
              {t.settings.dataClear || 'Delete Data'}
            </h3>
            <p className="text-muted-foreground mt-1 text-sm">
              {t.settings.dataClearDescription ||
                'Permanently delete ~/.vibework. This action cannot be undone.'}
            </p>
          </div>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={deleteStatus === 'loading'}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              'bg-red-500/10 text-red-500 hover:bg-red-500/20',
              'disabled:cursor-not-allowed disabled:opacity-50'
            )}
          >
            {getButtonContent(
              deleteStatus,
              <Trash2 className="size-4" />,
              t.settings.dataClearButton || 'Delete',
              t.settings.dataClearing || 'Deleting...'
            )}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="flex items-center gap-2 rounded-lg bg-red-500/10 p-3 text-red-500">
          <AlertTriangle className="size-4 shrink-0" />
          <span className="text-sm">{errorMessage}</span>
        </div>
      )}

      {/* Import Confirmation Dialog */}
      {showImportConfirm && (
        <div className="bg-background/80 fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="border-border bg-background mx-4 w-full max-w-md rounded-xl border p-6 shadow-lg">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
                <AlertTriangle className="size-5" />
              </div>
              <h3 className="text-foreground text-lg font-semibold">
                {t.settings.dataImportConfirmTitle || 'Import Data'}
              </h3>
            </div>

            <p className="text-muted-foreground mb-4 text-sm">
              {t.settings.dataImportConfirmDescription ||
                'This will back up your current data and replace it with the imported zip.'}
            </p>

            <div className="space-y-3">
              <div className="bg-muted rounded-lg p-3">
                <div className="text-muted-foreground mb-1 text-xs">
                  {t.settings.dataImportConfirmBackupLabel || 'Backup file'}
                </div>
                <code className="text-foreground text-xs break-all">
                  {pendingBackupDisplayPath || pendingBackupPath}
                </code>
              </div>
              <div className="bg-muted rounded-lg p-3">
                <div className="text-muted-foreground mb-1 text-xs">
                  {t.settings.dataImportConfirmTargetLabel || 'Restore target'}
                </div>
                <code className="text-foreground text-xs break-all">
                  {vibeworkDisplayPath}
                </code>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setShowImportConfirm(false);
                  setPendingImportPath(null);
                  setPendingBackupPath('');
                  setPendingBackupDisplayPath('');
                }}
                className={cn(
                  'flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                  'border-border text-foreground hover:bg-accent border'
                )}
              >
                {t.settings.dataCancel || 'Cancel'}
              </button>
              <button
                onClick={handleConfirmImport}
                className={cn(
                  'flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                  'bg-primary text-primary-foreground hover:bg-primary/90'
                )}
              >
                {t.settings.dataImportConfirmButton || 'Yes, Import'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="bg-background/80 fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="border-border bg-background mx-4 w-full max-w-md rounded-xl border p-6 shadow-lg">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-red-500/10 text-red-500">
                <AlertTriangle className="size-5" />
              </div>
              <h3 className="text-foreground text-lg font-semibold">
                {t.settings.dataDeleteConfirmTitle || 'Delete Data'}
              </h3>
            </div>

            <p className="text-muted-foreground mb-4 text-sm">
              {t.settings.dataDeleteConfirmDescription ||
                'This will permanently delete ~/.vibework. This action cannot be undone.'}
            </p>
            <div className="bg-muted mb-6 rounded-lg p-3">
              <code className="text-foreground text-xs break-all">
                {vibeworkDisplayPath}
              </code>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className={cn(
                  'flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                  'border-border text-foreground hover:bg-accent border'
                )}
              >
                {t.settings.dataCancel || 'Cancel'}
              </button>
              <button
                onClick={handleDelete}
                className={cn(
                  'flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                  'bg-red-500 text-white hover:bg-red-600'
                )}
              >
                {t.settings.dataDeleteConfirmButton || 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
