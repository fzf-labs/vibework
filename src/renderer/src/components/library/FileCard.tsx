import type { LibraryFile } from '@/data';
import { cn } from '@/lib/utils';
import {
  Code,
  File,
  FileText,
  Globe,
  MoreHorizontal,
  Star,
} from 'lucide-react';

interface FileCardProps {
  file: LibraryFile;
  onToggleFavorite?: (fileId: string) => void;
}

// Get icon for file type
function getFileIcon(type: string) {
  switch (type) {
    case 'website':
      return Globe;
    case 'text':
      return FileText;
    case 'code':
      return Code;
    case 'image':
      return File;
    case 'document':
      return FileText;
    default:
      return File;
  }
}

// Get file extension color for code files
function getCodeColor(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'py':
      return 'text-blue-500';
    case 'js':
    case 'jsx':
      return 'text-yellow-500';
    case 'ts':
    case 'tsx':
      return 'text-blue-600';
    case 'css':
      return 'text-pink-500';
    case 'html':
      return 'text-orange-500';
    case 'json':
      return 'text-green-500';
    case 'md':
      return 'text-gray-500';
    default:
      return 'text-muted-foreground';
  }
}

export function FileCard({ file, onToggleFavorite }: FileCardProps) {
  const FileIcon = getFileIcon(file.type);

  // Image/Website card with thumbnail
  if (file.type === 'image' || (file.type === 'website' && file.thumbnail)) {
    return (
      <div className="group border-border bg-card hover:border-primary/30 relative overflow-hidden rounded-xl border transition-all duration-200 hover:shadow-md">
        {/* Thumbnail */}
        <div className="bg-muted aspect-[4/3] overflow-hidden">
          {file.thumbnail ? (
            <img
              src={file.thumbnail}
              alt={file.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="from-primary/5 to-accent flex h-full w-full items-center justify-center bg-gradient-to-br">
              <FileIcon className="text-muted-foreground/50 size-12" />
            </div>
          )}
        </div>

        {/* File info */}
        <div className="p-3">
          <div className="flex items-start gap-2">
            <div className="bg-primary/10 flex size-7 shrink-0 items-center justify-center rounded-lg">
              <FileIcon className="text-primary size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-foreground truncate text-sm font-medium">
                {file.name}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite?.(file.id);
              }}
              className="text-muted-foreground hover:bg-accent hover:text-foreground flex size-6 cursor-pointer items-center justify-center rounded-md opacity-0 transition-all duration-200 group-hover:opacity-100"
            >
              <MoreHorizontal className="size-4" />
            </button>
          </div>
        </div>

        {/* Favorite indicator */}
        {file.is_favorite && (
          <div className="absolute top-2 right-2">
            <Star className="size-4 fill-yellow-500 text-yellow-500" />
          </div>
        )}
      </div>
    );
  }

  // Text/Code/Document card with preview
  return (
    <div className="group border-border bg-card hover:border-primary/30 relative overflow-hidden rounded-xl border transition-all duration-200 hover:shadow-md">
      {/* Header */}
      <div className="border-border/50 flex items-center gap-2 border-b px-3 py-2.5">
        <div
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-lg',
            file.type === 'code' ? 'bg-accent' : 'bg-primary/10'
          )}
        >
          <FileIcon
            className={cn(
              'size-4',
              file.type === 'code' ? getCodeColor(file.name) : 'text-primary'
            )}
          />
        </div>
        <span className="text-foreground flex-1 truncate text-sm font-medium">
          {file.name}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite?.(file.id);
          }}
          className="text-muted-foreground hover:bg-accent hover:text-foreground flex size-6 cursor-pointer items-center justify-center rounded-md opacity-0 transition-all duration-200 group-hover:opacity-100"
        >
          <MoreHorizontal className="size-4" />
        </button>
      </div>

      {/* Preview content */}
      <div className="max-h-32 overflow-hidden p-3">
        {file.type === 'code' ? (
          <pre className="text-muted-foreground font-mono text-xs break-all whitespace-pre-wrap">
            <code className={getCodeColor(file.name)}>
              {file.preview || '// No preview available'}
            </code>
          </pre>
        ) : (
          <p className="text-muted-foreground line-clamp-6 text-xs break-words whitespace-pre-wrap">
            {file.preview || 'No preview available'}
          </p>
        )}
      </div>

      {/* Favorite indicator */}
      {file.is_favorite && (
        <div className="absolute top-2 right-10">
          <Star className="size-4 fill-yellow-500 text-yellow-500" />
        </div>
      )}
    </div>
  );
}
