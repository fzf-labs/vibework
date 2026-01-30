import type { Artifact } from '@/components/artifacts';

// Helper to get artifact type from file extension
export function getArtifactTypeFromExt(
  ext: string | undefined
): Artifact['type'] {
  if (!ext) return 'text';
  if (ext === 'html' || ext === 'htm') return 'html';
  if (ext === 'jsx' || ext === 'tsx') return 'jsx';
  if (ext === 'css' || ext === 'scss' || ext === 'less') return 'css';
  if (ext === 'json') return 'json';
  if (ext === 'md' || ext === 'markdown') return 'markdown';
  if (ext === 'csv') return 'csv';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'doc' || ext === 'docx') return 'document';
  if (ext === 'xls' || ext === 'xlsx') return 'spreadsheet';
  if (ext === 'ppt' || ext === 'pptx') return 'presentation';
  if (
    [
      'mp3',
      'wav',
      'ogg',
      'm4a',
      'aac',
      'flac',
      'wma',
      'aiff',
    ].includes(ext)
  )
    return 'audio';
  if (
    [
      'mp4',
      'webm',
      'mov',
      'avi',
      'mkv',
      'm4v',
      'wmv',
      'flv',
      '3gp',
    ].includes(ext)
  )
    return 'video';
  if (['ttf', 'otf', 'woff', 'woff2'].includes(ext)) return 'font';
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp'].includes(ext))
    return 'image';
  if (
    [
      'js',
      'ts',
      'py',
      'rs',
      'go',
      'java',
      'c',
      'cpp',
      'h',
      'hpp',
      'rb',
      'php',
      'swift',
      'kt',
      'scala',
      'sh',
      'bash',
      'zsh',
      'sql',
      'yaml',
      'yml',
      'toml',
      'ini',
      'xml',
    ].includes(ext)
  )
    return 'code';
  return 'text';
}
