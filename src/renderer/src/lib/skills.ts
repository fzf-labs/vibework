import { API_BASE_URL } from '@/config';
import type { SkillFile, SkillInfo } from '@/components/settings/types';

export const CLI_SKILL_DIRECTORIES: Record<string, string> = {
  'claude-code': '.claude/skills',
  codex: '.codex/skills',
  'gemini-cli': '.gemini/skills',
  opencode: '.opencode/skills',
  'cursor-agent': '.cursor/skills',
};

export interface ProjectSkillsSettings {
  enabled: boolean;
  includeDefaultDirectories: boolean;
  customDirectories: string[];
}

export const DEFAULT_PROJECT_SKILLS_SETTINGS: ProjectSkillsSettings = {
  enabled: true,
  includeDefaultDirectories: true,
  customDirectories: [],
};

export interface ProjectSkillDirectory {
  id: string;
  label: string;
  path: string;
  source: string;
}

export function parseSkillMdFrontmatter(content: string): {
  name?: string;
  description?: string;
} {
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) return {};

  const frontmatter = frontmatterMatch[1];
  const result: { name?: string; description?: string } = {};

  const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
  if (nameMatch) {
    result.name = nameMatch[1].trim();
  }

  const descMatch = frontmatter.match(/^description:\s*(.+)$/m);
  if (descMatch) {
    result.description = descMatch[1].trim();
  }

  return result;
}

export const formatCliLabel = (id: string) =>
  id
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');

const isAbsolutePath = (value: string) =>
  value.startsWith('/') ||
  value.startsWith('~') ||
  /^[A-Za-z]:[\\/]/.test(value) ||
  value.startsWith('\\\\');

const joinPath = (base: string, relative: string) =>
  `${base.replace(/\/$/, '')}/${relative.replace(/^\//, '')}`;

export async function resolvePath(targetPath: string): Promise<string> {
  if (!targetPath) return targetPath;
  if (targetPath.startsWith('~') && window.api?.path?.homeDir) {
    const homeDir = await window.api.path.homeDir();
    return targetPath.replace(/^~(?=\/|\\)/, homeDir);
  }
  return targetPath;
}

export async function readDirectoryEntries(
  directoryPath: string
): Promise<SkillFile[]> {
  if (!directoryPath) return [];
  try {
    const resolvedPath = await resolvePath(directoryPath);
    if (window.api?.fs?.exists) {
      const exists = await window.api.fs.exists(resolvedPath);
      if (!exists) return [];
    }
    if (window.api?.fs?.readDir) {
      return (await window.api.fs.readDir(resolvedPath, {
        maxDepth: 3,
      })) as SkillFile[];
    }
  } catch (err) {
    console.error('[Skills] Failed to read directory:', err);
    return [];
  }

  try {
    const resolvedPath = await resolvePath(directoryPath);
    const filesResponse = await fetch(`${API_BASE_URL}/files/readdir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: resolvedPath, maxDepth: 3 }),
    });
    const filesData = await filesResponse.json();
    if (filesData.success && filesData.files) {
      return filesData.files as SkillFile[];
    }
  } catch (err) {
    console.error('[Skills] Failed to read directory via API:', err);
  }

  return [];
}

export async function readSkillMarkdown(skillMdPath: string): Promise<string> {
  try {
    const resolvedPath = await resolvePath(skillMdPath);
    if (window.api?.fs?.exists) {
      const exists = await window.api.fs.exists(resolvedPath);
      if (!exists) return '';
    }
    if (window.api?.fs?.readTextFile) {
      return await window.api.fs.readTextFile(resolvedPath);
    }
  } catch (err) {
    console.error('[Skills] Failed to read skill file:', err);
    return '';
  }

  try {
    const resolvedPath = await resolvePath(skillMdPath);
    const mdResponse = await fetch(`${API_BASE_URL}/files/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: resolvedPath }),
    });
    const mdData = await mdResponse.json();
    if (mdData.success && mdData.content) {
      return mdData.content as string;
    }
  } catch (err) {
    console.error('[Skills] Failed to read skill file via API:', err);
  }

  return '';
}

export async function loadSkillsFromDirectory(
  directoryPath: string,
  source: string
): Promise<SkillInfo[]> {
  try {
    const filesData = await readDirectoryEntries(directoryPath);
    if (!filesData.length) return [];

    const skillsFromDir: SkillInfo[] = [];
    for (const folder of filesData) {
      if (!folder.isDir) continue;

      let skillName = folder.name;
      let description = '';
      try {
        const skillMdCandidates = ['SKILL.md', 'skill.md'];
        let content = '';

        for (const candidate of skillMdCandidates) {
          const skillMdPath = `${folder.path}/${candidate}`;
          content = await readSkillMarkdown(skillMdPath);
          if (content) break;
        }

        if (!content) {
          continue;
        }

        const frontmatter = parseSkillMdFrontmatter(content);
        if (frontmatter.name) {
          skillName = frontmatter.name;
        }
        if (frontmatter.description) {
          description = frontmatter.description;
        }
      } catch {
        continue;
      }

      skillsFromDir.push({
        id: `${source}-${folder.name}`,
        name: skillName,
        source,
        path: folder.path,
        files: folder.children || [],
        enabled: true,
        description,
      });
    }

    return skillsFromDir;
  } catch (err) {
    console.error(`[Skills] Failed to load skills from ${directoryPath}:`, err);
    return [];
  }
}

export async function openFolderInSystem(folderPath: string) {
  try {
    let resolvedPath = folderPath;
    if (resolvedPath.startsWith('~') && window.api?.path?.homeDir) {
      const homeDir = await window.api.path.homeDir();
      resolvedPath = resolvedPath.replace(/^~(?=\/|\\)/, homeDir);
    }

    if (window.api?.fs?.exists && window.api?.fs?.mkdir) {
      const exists = await window.api.fs.exists(resolvedPath);
      if (!exists) {
        await window.api.fs.mkdir(resolvedPath);
      }
    }

    if (window.api?.shell?.openPath) {
      await window.api.shell.openPath(resolvedPath);
      return;
    }

    const response = await fetch(`${API_BASE_URL}/files/open`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: resolvedPath, expandHome: true }),
    });
    const data = await response.json();
    if (!data.success) {
      console.error('[Skills] Failed to open folder:', data.error);
    }
  } catch (err) {
    console.error('[Skills] Error opening folder:', err);
  }
}

export async function resolveProjectSkillDirectories(
  projectPath: string,
  settings: ProjectSkillsSettings,
  cliTools: Array<{ id: string; displayName?: string }> = []
): Promise<ProjectSkillDirectory[]> {
  if (!projectPath || !settings.enabled) return [];

  const directories: ProjectSkillDirectory[] = [];
  const seenPaths = new Set<string>();
  const defaultTools =
    cliTools.length > 0
      ? cliTools
      : [{ id: 'codex', displayName: 'Codex' }];

  const pushDirectory = (dir: ProjectSkillDirectory) => {
    if (seenPaths.has(dir.path)) return;
    seenPaths.add(dir.path);
    directories.push(dir);
  };

  if (settings.includeDefaultDirectories) {
    for (const tool of defaultTools) {
      const relativeDir = CLI_SKILL_DIRECTORIES[tool.id];
      if (!relativeDir) continue;
      pushDirectory({
        id: `project-${tool.id}`,
        label: `${tool.displayName || formatCliLabel(tool.id)} (Project)`,
        path: joinPath(projectPath, relativeDir),
        source: tool.id,
      });
    }
  }

  if (settings.customDirectories?.length) {
    settings.customDirectories.forEach((customPath, index) => {
      const resolvedPath = isAbsolutePath(customPath)
        ? customPath
        : joinPath(projectPath, customPath);
      pushDirectory({
        id: `custom-${index}`,
        label: `Custom (${customPath})`,
        path: resolvedPath,
        source: 'custom',
      });
    });
  }

  return directories;
}
