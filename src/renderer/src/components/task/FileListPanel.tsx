import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  FileCode2,
  FileText,
  Folder,
  Image,
  Music,
  RefreshCw,
  Video,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fs } from '@/lib/electron-api';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/providers/language-provider';
import type { Artifact } from '@/components/artifacts';
import { getArtifactTypeFromExt } from './utils';

interface WorkspaceEntry {
  name: string;
  path: string;
  isDir: boolean;
  children?: WorkspaceEntry[];
}

interface FileListPanelProps {
  artifacts: Artifact[];
  workingDir: string;
  selectedArtifact: Artifact | null;
  onSelectArtifact: (artifact: Artifact) => void;
}

const sortEntries = (entries: WorkspaceEntry[]) =>
  [...entries].sort((a, b) => {
    if (a.isDir && !b.isDir) return -1;
    if (!a.isDir && b.isDir) return 1;
    return a.name.localeCompare(b.name, undefined, {
      numeric: true,
      sensitivity: 'base',
    });
  });

const getArtifactIcon = (artifact: Artifact | WorkspaceEntry) => {
  if ('isDir' in artifact) {
    return Folder;
  }
  switch (artifact.type) {
    case 'code':
    case 'json':
    case 'jsx':
    case 'css':
    case 'text':
    case 'markdown':
      return FileCode2;
    case 'image':
      return Image;
    case 'audio':
      return Music;
    case 'video':
      return Video;
    case 'websearch':
      return Search;
    default:
      return FileText;
  }
};

const updateChildren = (
  entries: WorkspaceEntry[],
  targetPath: string,
  children: WorkspaceEntry[]
): WorkspaceEntry[] => {
  return entries.map((entry) => {
    if (entry.path === targetPath) {
      return { ...entry, children: sortEntries(children) };
    }
    if (entry.children && entry.children.length > 0) {
      return {
        ...entry,
        children: updateChildren(entry.children, targetPath, children),
      };
    }
    return entry;
  });
};

export function FileListPanel({
  artifacts,
  workingDir,
  selectedArtifact,
  onSelectArtifact,
}: FileListPanelProps) {
  const { t } = useLanguage();
  const [workspaceEntries, setWorkspaceEntries] = useState<WorkspaceEntry[]>([]);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());

  const hasWorkspace = Boolean(workingDir);

  const loadWorkspaceRoot = useCallback(async () => {
    if (!workingDir) {
      setWorkspaceEntries([]);
      setWorkspaceError(null);
      return;
    }
    setWorkspaceLoading(true);
    setWorkspaceError(null);
    try {
      const entries = (await fs.readDir(workingDir, {
        maxDepth: 1,
      })) as WorkspaceEntry[];
      setWorkspaceEntries(sortEntries(entries));
    } catch (error) {
      console.error('[FileListPanel] Failed to load workspace:', error);
      setWorkspaceEntries([]);
      setWorkspaceError(
        error instanceof Error ? error.message : String(error)
      );
    } finally {
      setWorkspaceLoading(false);
    }
  }, [workingDir]);

  useEffect(() => {
    void loadWorkspaceRoot();
  }, [loadWorkspaceRoot]);

  const handleToggleDir = useCallback(
    async (entry: WorkspaceEntry) => {
      if (!entry.isDir) return;
      const isExpanded = expandedPaths.has(entry.path);

      if (isExpanded) {
        setExpandedPaths((prev) => {
          const next = new Set(prev);
          next.delete(entry.path);
          return next;
        });
        return;
      }

      setExpandedPaths((prev) => new Set(prev).add(entry.path));

      if (entry.children && entry.children.length > 0) {
        return;
      }

      setLoadingPaths((prev) => new Set(prev).add(entry.path));
      try {
        const children = (await fs.readDir(entry.path, {
          maxDepth: 1,
        })) as WorkspaceEntry[];
        setWorkspaceEntries((prev) =>
          updateChildren(prev, entry.path, children)
        );
      } catch (error) {
        console.error('[FileListPanel] Failed to load directory:', error);
        setWorkspaceError(
          error instanceof Error ? error.message : String(error)
        );
      } finally {
        setLoadingPaths((prev) => {
          const next = new Set(prev);
          next.delete(entry.path);
          return next;
        });
      }
    },
    [expandedPaths]
  );

  const handleSelectWorkspaceFile = useCallback(
    (entry: WorkspaceEntry) => {
      if (entry.isDir) return;
      const ext = entry.name.split('.').pop()?.toLowerCase();
      onSelectArtifact({
        id: entry.path,
        name: entry.name,
        type: getArtifactTypeFromExt(ext),
        path: entry.path,
      });
    },
    [onSelectArtifact]
  );

  const isSelected = useCallback(
    (candidate: { id?: string; path?: string }) => {
      if (!selectedArtifact) return false;
      if (candidate.path && selectedArtifact.path === candidate.path) return true;
      if (candidate.id && selectedArtifact.id === candidate.id) return true;
      return false;
    },
    [selectedArtifact]
  );

  const artifactItems = useMemo(() => artifacts, [artifacts]);

  const renderWorkspaceEntries = (
    entries: WorkspaceEntry[],
    depth = 0
  ): ReactNode => {
    return entries.map((entry) => {
      const expanded = expandedPaths.has(entry.path);
      const isLoading = loadingPaths.has(entry.path);
      const Icon = getArtifactIcon(entry);
      const indent = depth * 12;

      return (
        <div key={entry.path} className="space-y-1">
          <button
            type="button"
            onClick={() =>
              entry.isDir ? void handleToggleDir(entry) : handleSelectWorkspaceFile(entry)
            }
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors',
              isSelected(entry) ? 'bg-accent text-foreground' : 'hover:bg-accent/60'
            )}
            style={{ paddingLeft: 8 + indent }}
          >
            {entry.isDir ? (
              expanded ? (
                <ChevronDown className="size-3 text-muted-foreground" />
              ) : (
                <ChevronRight className="size-3 text-muted-foreground" />
              )
            ) : (
              <span className="size-3" />
            )}
            <Icon
              className={cn(
                'size-3.5',
                entry.isDir ? 'text-amber-500' : 'text-muted-foreground'
              )}
            />
            <span className="truncate" title={entry.name}>
              {entry.name}
            </span>
            {isLoading && (
              <span className="ml-auto text-[10px] text-muted-foreground">
                {t.common.loading}
              </span>
            )}
          </button>
          {entry.isDir && expanded && entry.children && entry.children.length > 0 && (
            <div>{renderWorkspaceEntries(entry.children, depth + 1)}</div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="flex h-full w-72 shrink-0 flex-col border-r">
      <div className="border-b px-3 py-2">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-xs font-medium">
            {t.preview.fileList}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadWorkspaceRoot}
            disabled={!hasWorkspace || workspaceLoading}
            className="h-7 px-2"
            title={t.preview.refresh}
          >
            <RefreshCw className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3">
        <div className="space-y-4">
          <div>
            <div className="text-muted-foreground mb-2 text-[11px] font-semibold uppercase tracking-wide">
              {t.preview.artifactsSection}
            </div>
            <div className="space-y-1">
              {artifactItems.length === 0 ? (
                <div className="text-muted-foreground text-xs">
                  {t.preview.artifactsEmpty}
                </div>
              ) : (
                artifactItems.map((artifact) => {
                  const Icon = getArtifactIcon(artifact);
                  return (
                    <button
                      key={artifact.id}
                      type="button"
                      onClick={() => onSelectArtifact(artifact)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors',
                        isSelected(artifact)
                          ? 'bg-accent text-foreground'
                          : 'hover:bg-accent/60'
                      )}
                    >
                      <Icon className="size-3.5 text-muted-foreground" />
                      <span className="truncate" title={artifact.name}>
                        {artifact.name}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div>
            <div className="text-muted-foreground mb-2 text-[11px] font-semibold uppercase tracking-wide">
              {t.preview.workspaceSection}
            </div>
            <div className="space-y-1">
              {!hasWorkspace && (
                <div className="text-muted-foreground text-xs">
                  {t.preview.workspaceEmpty}
                </div>
              )}
              {hasWorkspace && workspaceLoading && (
                <div className="text-muted-foreground text-xs">
                  {t.preview.loadingWorkspace}
                </div>
              )}
              {hasWorkspace && workspaceError && !workspaceLoading && (
                <div className="text-xs text-red-500">
                  {t.preview.workspaceError}
                  <div className="text-muted-foreground mt-1 break-all text-[10px]">
                    {workspaceError}
                  </div>
                </div>
              )}
              {hasWorkspace && !workspaceLoading && !workspaceError && (
                <>
                  {workspaceEntries.length === 0 ? (
                    <div className="text-muted-foreground text-xs">
                      {t.preview.workspaceEmptyFiles}
                    </div>
                  ) : (
                    renderWorkspaceEntries(workspaceEntries)
                  )}
                </>
              )}
            </div>
            {hasWorkspace && (
              <div
                className="text-muted-foreground mt-2 truncate text-[10px]"
                title={workingDir}
              >
                {workingDir}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
