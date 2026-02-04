const FILE_PATH_PATTERNS = [
  // Match paths in backticks
  /`([^`]+\.(?:pptx|xlsx|docx|pdf))`/gi,
  // Match absolute paths
  /(\/[^\s"'`\n]+\.(?:pptx|xlsx|docx|pdf))/gi,
  // Match Chinese/unicode paths
  /(\/[^\s"'\n]*[\u4e00-\u9fff][^\s"'\n]*\.(?:pptx|xlsx|docx|pdf))/gi,
];

export const extractFilePaths = (text: string): string[] => {
  const results: string[] = [];
  for (const pattern of FILE_PATH_PATTERNS) {
    pattern.lastIndex = 0;
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const filePath = match[1] || match[0];
      if (filePath) {
        results.push(filePath);
      }
    }
  }
  return results;
};

export const hasFilePathMatch = (text: string): boolean => {
  return FILE_PATH_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(text);
  });
};
