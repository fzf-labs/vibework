// File handling utilities for agent

import { db, type FileType } from '@/data';

// Helper to determine file type from file extension
export function getFileTypeFromPath(path: string): FileType {
  const ext = path.split('.').pop()?.toLowerCase() || '';

  // Code files
  if (
    [
      'js',
      'jsx',
      'ts',
      'tsx',
      'py',
      'go',
      'rs',
      'java',
      'c',
      'cpp',
      'h',
      'hpp',
      'cs',
      'rb',
      'php',
      'swift',
      'kt',
      'scala',
      'sh',
      'bash',
      'zsh',
      'ps1',
      'sql',
    ].includes(ext)
  ) {
    return 'code';
  }

  // Image files
  if (
    ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico'].includes(ext)
  ) {
    return 'image';
  }

  // Presentation files
  if (['ppt', 'pptx', 'key', 'odp'].includes(ext)) {
    return 'presentation';
  }

  // Spreadsheet files
  if (['xls', 'xlsx', 'numbers', 'ods'].includes(ext)) {
    return 'spreadsheet';
  }

  // Document files
  if (['md', 'pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'].includes(ext)) {
    return 'document';
  }

  // Text files (config, data)
  if (
    [
      'json',
      'yaml',
      'yml',
      'xml',
      'toml',
      'ini',
      'conf',
      'cfg',
      'env',
      'csv',
      'tsv',
    ].includes(ext)
  ) {
    return 'text';
  }

  // HTML files
  if (['html', 'htm'].includes(ext)) {
    return 'website';
  }

  // Default to text
  return 'text';
}

// Extract file paths from text content (for text messages that mention file paths)
export async function extractFilesFromText(
  taskId: string,
  textContent: string
): Promise<void> {
  if (!textContent) return;

  try {
    // Patterns to match file paths in text
    const filePatterns = [
      // Match paths in backticks with common document extensions
      /`([^`]+\.(?:pptx|xlsx|docx|pdf))`/gi,
      // Match absolute paths with Chinese/unicode support
      /(\/[^\s"'`\n]*[\u4e00-\u9fff][^\s"'`\n]*\.(?:pptx|xlsx|docx|pdf))/gi,
      // Match standard absolute paths
      /(\/(?:Users|home|tmp|var)[^\s"'`\n]+\.(?:pptx|xlsx|docx|pdf))/gi,
    ];

    const detectedFiles = new Set<string>();

    for (const pattern of filePatterns) {
      const matches = textContent.matchAll(pattern);
      for (const match of matches) {
        const filePath = match[1] || match[0];
        if (filePath && !detectedFiles.has(filePath)) {
          detectedFiles.add(filePath);
          const fileName = filePath.split('/').pop() || filePath;
          const fileType = getFileTypeFromPath(filePath);

          await db.createFile({
            task_id: taskId,
            name: fileName,
            type: fileType,
            path: filePath,
            preview: `File mentioned in response`,
          });
          console.log(
            '[useAgent] Created file record from text message:',
            fileName
          );
        }
      }
    }
  } catch (error) {
    console.error('[useAgent] Failed to extract files from text:', error);
  }
}
