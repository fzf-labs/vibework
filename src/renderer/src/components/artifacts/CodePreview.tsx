import { useEffect, useMemo, useState } from 'react';
import { useTheme } from '@/providers/theme-provider';
import { useLanguage } from '@/providers/language-provider';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import {
  oneDark,
  oneLight,
} from 'react-syntax-highlighter/dist/esm/styles/prism';

import type { PreviewComponentProps } from './types';
import { getLanguageHint } from './utils';

const MAX_HIGHLIGHT_LINES = 1000;
const MAX_HIGHLIGHT_BYTES = 200 * 1024;

export function CodePreview({ artifact }: PreviewComponentProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [forceHighlight, setForceHighlight] = useState(false);

  const content = artifact.content || '';

  const lineCount = useMemo(() => content.split('\n').length, [content]);
  const contentBytes = useMemo(
    () => new TextEncoder().encode(content).length,
    [content]
  );
  const isLarge = useMemo(
    () => lineCount > MAX_HIGHLIGHT_LINES || contentBytes > MAX_HIGHLIGHT_BYTES,
    [lineCount, contentBytes]
  );

  useEffect(() => {
    setForceHighlight(false);
  }, [artifact.id, artifact.name, content]);

  if (!content) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <p className="text-muted-foreground text-sm">No content available</p>
      </div>
    );
  }

  const language = getLanguageHint(artifact);
  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  if (isLarge && !forceHighlight) {
    return (
      <div className="h-full overflow-auto">
        <div className="border-border/50 bg-muted/20 flex items-center justify-between border-b px-3 py-2 text-xs">
          <span className="text-muted-foreground">
            {t.preview.largeFileHint}
          </span>
          <button
            onClick={() => setForceHighlight(true)}
            className="text-primary hover:text-primary/80 font-medium"
          >
            {t.preview.enableHighlight}
          </button>
        </div>
        <pre className="text-foreground whitespace-pre-wrap break-words px-3 py-2 text-xs leading-relaxed">
          {content}
        </pre>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <SyntaxHighlighter
        language={language}
        style={isDark ? oneDark : oneLight}
        showLineNumbers
        wrapLines
        customStyle={{
          margin: 0,
          padding: '0.5rem 0',
          fontSize: '12px',
          lineHeight: '1.4',
          background: 'transparent',
          minHeight: '100%',
        }}
        codeTagProps={{
          style: {
            background: 'transparent',
          },
        }}
        lineProps={{
          style: {
            background: 'transparent',
            display: 'block',
          },
        }}
        lineNumberStyle={{
          minWidth: '3em',
          paddingRight: '1em',
          paddingLeft: '0.5em',
          color: isDark ? '#636d83' : '#9ca3af',
          userSelect: 'none',
          background: 'transparent',
        }}
      >
        {content}
      </SyntaxHighlighter>
    </div>
  );
}
