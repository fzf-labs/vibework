import { useEffect, useMemo, useState } from 'react';
import { DiffModeEnum, DiffView } from '@git-diff-view/react';
import type { DiffFile as GitDiffFileModel } from '@git-diff-view/file';
import { DiffFile, generateDiffFile } from '@git-diff-view/file';
import {
  getDiffViewHighlighter,
  type DiffHighlighter,
} from '@git-diff-view/shiki';
import '@git-diff-view/react/styles/diff-view-pure.css';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTheme } from '@/providers/theme-provider';

export interface GitDiffViewProps {
  diffText: string;
  stagedDiffText?: string;
  loading?: boolean;
  error?: string | null;
  className?: string;
}

interface ParsedDiffFile {
  key: string;
  oldPath: string;
  newPath: string;
  diffText: string;
  isBinary: boolean;
  additions: number;
  deletions: number;
  isNew: boolean;
  isDeleted: boolean;
  isRenamed: boolean;
}

const DIFF_LANG_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  json: 'json',
  md: 'markdown',
  html: 'html',
  css: 'css',
  scss: 'scss',
  go: 'go',
  py: 'python',
  java: 'java',
  rs: 'rust',
};

function normalizeDiffText(diffText: string): string {
  if (!diffText) return '';
  let normalized = diffText.replace(/\r\n/g, '\n');
  normalized = normalized.replace(/\n+$/, '\n');
  if (normalized.endsWith('\n+\n') || normalized.endsWith('\n-\n')) {
    normalized = normalized.slice(0, -1);
  }
  const lines = normalized.split('\n');
  const lastLine = lines[lines.length - 1];
  if (lastLine === '+' || lastLine === '-') {
    lines[lines.length - 1] = `${lastLine} `;
    normalized = lines.join('\n');
  }
  return normalized;
}

function parseUnifiedDiff(diffText: string): ParsedDiffFile[] {
  if (!diffText?.trim()) return [];
  const normalized = diffText.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');

  const blocks: string[] = [];
  let current: string[] = [];

  const pushCurrent = () => {
    const text = current.join('\n').trim();
    if (text) {
      blocks.push(text);
    }
    current = [];
  };

  for (const line of lines) {
    if (line.startsWith('diff --git ') && current.length > 0) {
      pushCurrent();
    }
    current.push(line);
  }
  pushCurrent();

  return blocks.map((blockText, index) => {
    const blockLines = blockText.split('\n');
    let oldPath = '';
    let newPath = '';
    let isBinary = false;
    let additions = 0;
    let deletions = 0;
    let isNew = false;
    let isDeleted = false;
    let isRenamed = false;

    for (const line of blockLines) {
      if (line.startsWith('Binary files ')) {
        isBinary = true;
      }
      if (line.startsWith('new file mode')) {
        isNew = true;
      }
      if (line.startsWith('deleted file mode')) {
        isDeleted = true;
      }
      if (line.startsWith('rename from') || line.startsWith('rename to')) {
        isRenamed = true;
      }
      if (line.startsWith('--- ')) {
        const raw = line.slice(4).trim();
        oldPath = raw.startsWith('a/') ? raw.slice(2) : raw;
      }
      if (line.startsWith('+++ ')) {
        const raw = line.slice(4).trim();
        newPath = raw.startsWith('b/') ? raw.slice(2) : raw;
      }
      if (line.startsWith('+') && !line.startsWith('+++')) {
        additions += 1;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        deletions += 1;
      }
    }

    const key = oldPath || newPath ? `${oldPath}->${newPath}` : `file-${index}`;

    return {
      key,
      oldPath,
      newPath,
      diffText: blockText,
      isBinary,
      additions,
      deletions,
      isNew,
      isDeleted,
      isRenamed,
    };
  });
}

function getFileLanguage(path: string): string | null {
  if (!path) return null;
  const ext = path.split('.').pop()?.toLowerCase() || '';
  return DIFF_LANG_MAP[ext] || ext || null;
}

function buildDiffFileFromContents(
  file: ParsedDiffFile,
  contents: { oldContent?: string | null; newContent?: string | null } | null,
  theme: 'light' | 'dark',
  fileLang: string | null,
): GitDiffFileModel | null {
  if (!contents?.oldContent && !contents?.newContent) {
    return null;
  }
  const diffFile = generateDiffFile(
    file.oldPath || '',
    contents?.oldContent || '',
    file.newPath || '',
    contents?.newContent || '',
    fileLang || '',
    fileLang || '',
  );
  diffFile.initTheme(theme);
  diffFile.init();
  diffFile.buildSplitDiffLines();
  diffFile.buildUnifiedDiffLines();
  return diffFile;
}

function buildDiffData(file: ParsedDiffFile, fileLang: string | null) {
  return {
    oldFile: {
      fileName: file.isNew ? null : file.oldPath || null,
      fileLang,
      content: null,
    },
    newFile: {
      fileName: file.isDeleted ? null : file.newPath || null,
      fileLang,
      content: null,
    },
    hunks: [normalizeDiffText(file.diffText)],
  };
}

function createDiffFileFromHunks(
  data: ReturnType<typeof buildDiffData>,
  theme: 'light' | 'dark',
): GitDiffFileModel | null {
  if (typeof DiffFile?.createInstance !== 'function') {
    return null;
  }

  const diffFile = DiffFile.createInstance(data);
  diffFile.initTheme(theme);
  diffFile.init();
  diffFile.buildSplitDiffLines();
  diffFile.buildUnifiedDiffLines();
  return diffFile;
}

function FileHeader({ file }: { file: ParsedDiffFile }) {
  const displayPath = file.isRenamed && file.oldPath && file.newPath
    ? `${file.oldPath} -> ${file.newPath}`
    : file.newPath || file.oldPath || 'unknown';

  return (
    <div className="flex items-center gap-2">
      {file.isNew && (
        <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-600">
          新增
        </span>
      )}
      {file.isDeleted && (
        <span className="rounded bg-rose-500/15 px-2 py-0.5 text-xs text-rose-600">
          删除
        </span>
      )}
      {file.isRenamed && (
        <span className="rounded bg-amber-500/15 px-2 py-0.5 text-xs text-amber-600">
          重命名
        </span>
      )}
      {!file.isNew && !file.isDeleted && !file.isRenamed && (
        <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          修改
        </span>
      )}
      <span className="font-mono text-xs text-foreground">{displayPath}</span>
      <div className="ml-auto flex items-center gap-3 text-xs">
        <span className="text-emerald-500">+{file.additions}</span>
        <span className="text-rose-500">-{file.deletions}</span>
      </div>
    </div>
  );
}

export function GitDiffView({
  diffText,
  stagedDiffText,
  loading,
  error,
  className,
}: GitDiffViewProps) {
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === 'dark' ? 'dark' : 'light';
  const [diffMode, setDiffMode] = useState(DiffModeEnum.Unified);
  const [highlighter, setHighlighter] = useState<DiffHighlighter | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDiffViewHighlighter().then((hl) => {
      if (!cancelled) {
        setHighlighter(hl);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const groups = useMemo(() => {
    const result: Array<{ title: string; files: ParsedDiffFile[] }> = [];
    const unstaged = parseUnifiedDiff(diffText);
    const staged = parseUnifiedDiff(stagedDiffText || '');
    if (unstaged.length) {
      result.push({ title: '未暂存变更', files: unstaged });
    }
    if (staged.length) {
      result.push({ title: '已暂存变更', files: staged });
    }
    return result;
  }, [diffText, stagedDiffText]);

  if (loading) {
    return (
      <div className={cn('flex h-full items-center justify-center text-sm text-muted-foreground', className)}>
        加载 diff 中…
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('flex h-full flex-col items-center justify-center gap-2 text-center text-sm', className)}>
        <div className="text-foreground font-medium">无法加载 diff</div>
        <div className="text-muted-foreground max-w-[320px] text-xs">{error}</div>
      </div>
    );
  }

  if (!groups.length) {
    return (
      <div className={cn('flex h-full items-center justify-center text-sm text-muted-foreground', className)}>
        暂无变更
      </div>
    );
  }

  return (
    <div className={cn('flex h-full flex-col gap-4 overflow-auto', className)}>
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">共 {groups.reduce((acc, group) => acc + group.files.length, 0)} 个文件</div>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={diffMode === DiffModeEnum.Unified ? 'secondary' : 'ghost'}
            onClick={() => setDiffMode(DiffModeEnum.Unified)}
          >
            Unified
          </Button>
          <Button
            size="sm"
            variant={diffMode === DiffModeEnum.Split ? 'secondary' : 'ghost'}
            onClick={() => setDiffMode(DiffModeEnum.Split)}
          >
            Split
          </Button>
        </div>
      </div>

      {groups.map((group) => (
        <div key={group.title} className="space-y-3">
          <div className="text-xs font-medium text-muted-foreground">{group.title}</div>
          {group.files.map((file) => {
            const fileLang = getFileLanguage(file.newPath || file.oldPath);
            const diffData = buildDiffData(file, fileLang);
            const diffFile = createDiffFileFromHunks(diffData, theme);
            const contentDiffFile = buildDiffFileFromContents(file, null, theme, fileLang);
            const resolvedDiffFile = contentDiffFile ?? diffFile ?? undefined;

            return (
              <div key={`${group.title}-${file.key}`} className="rounded-lg border bg-background">
                <div className="border-b px-3 py-2">
                  <FileHeader file={file} />
                </div>
                <div className="git-diff-view overflow-x-auto">
                  {file.isBinary ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      Binary file diff can't be rendered.
                    </div>
                  ) : (
                    <DiffView
                      diffFile={resolvedDiffFile}
                      data={!resolvedDiffFile ? diffData : undefined}
                      diffViewTheme={theme}
                      diffViewMode={diffMode}
                      diffViewHighlight={!!highlighter}
                      diffViewWrap={false}
                      registerHighlighter={highlighter ?? undefined}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
