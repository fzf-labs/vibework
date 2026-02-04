import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/providers/language-provider';
import {
  CLI_SKILL_DIRECTORIES,
  loadSkillsFromDirectory,
  openFolderInSystem,
  resolvePath,
} from '@/lib/skills';
import {
  ArrowLeftRight,
  FolderOpen,
  Github,
  Layers,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';

import { API_BASE_URL } from '../constants';
import type { SettingsTabProps, SkillInfo } from '../types';

// Skill card component
function SkillCard({
  skill,
  onDelete,
  readOnly = false,
}: {
  skill: SkillInfo;
  onDelete?: () => void;
  readOnly?: boolean;
}) {
  const { t } = useLanguage();
  const [showMenu, setShowMenu] = useState(false);
  const showActions = !readOnly && onDelete;

  return (
    <div className="border-border bg-background hover:border-foreground/20 relative flex flex-col rounded-xl border p-4 transition-colors">
      <div className="mb-2">
        <span className="text-foreground text-sm font-medium">
          {skill.name}
        </span>
      </div>

      <p className="text-muted-foreground mb-4 line-clamp-2 flex-1 text-xs">
        {skill.description || t.settings.skillsNoDescription}
      </p>

      {showActions && (
        <div className="border-border flex items-center justify-end border-t pt-3">
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="text-muted-foreground hover:bg-accent hover:text-foreground rounded p-1 transition-colors"
            >
              <MoreHorizontal className="size-4" />
            </button>
            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowMenu(false)}
                />
                <div className="border-border bg-popover absolute right-0 bottom-full z-20 mb-1 min-w-max rounded-lg border py-1 shadow-lg">
                  <button
                    onClick={() => {
                      openFolderInSystem(skill.path);
                      setShowMenu(false);
                    }}
                    className="hover:bg-accent flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm whitespace-nowrap transition-colors"
                  >
                    <FolderOpen className="size-3.5 shrink-0" />
                    {t.settings.skillsOpenFolder}
                  </button>
                  <button
                    onClick={() => {
                      onDelete?.();
                      setShowMenu(false);
                    }}
                    className="hover:bg-destructive/10 text-destructive flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm whitespace-nowrap transition-colors"
                  >
                    <Trash2 className="size-3.5 shrink-0" />
                    {t.settings.skillsDelete}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

type MainTab = 'installed' | 'cli';
type CliSkillGroup = {
  id: string;
  label: string;
  path: string;
  exists: boolean;
  skills: SkillInfo[];
};

export function SkillsSettings({
  settings,
}: SettingsTabProps) {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [cliSkillGroups, setCliSkillGroups] = useState<CliSkillGroup[]>([]);
  const [mainTab, setMainTab] = useState<MainTab>('installed');
  const [loading, setLoading] = useState(true);
  const [showGitHubImport, setShowGitHubImport] = useState(false);
  const [githubUrl, setGithubUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [homeDir, setHomeDir] = useState<string | null>(null);
  const { t } = useLanguage();
  const defaultAppSkillsPath = '~/.vibework/skills';
  const appSkillsPath = settings.skillsPath || defaultAppSkillsPath;

  const isSkillConfigured = (skill: SkillInfo) => {
    return skill.files.length > 0;
  };

  const appSkillsSorted = skills
    .sort((a, b) => {
      const aConfigured = isSkillConfigured(a);
      const bConfigured = isSkillConfigured(b);
      if (a.enabled && aConfigured && !(b.enabled && bConfigured)) return -1;
      if (b.enabled && bConfigured && !(a.enabled && aConfigured)) return 1;
      if (aConfigured && !bConfigured) return -1;
      if (bConfigured && !aConfigured) return 1;
      return 0;
    });

  const cliGroupsVisible = cliSkillGroups.filter(
    (group) => group.skills.length > 0
  );

  const formatCliLabel = useCallback((id: string) => {
    const runtime = settings.agentRuntimes.find((item) => item.id === id);
    if (runtime) return runtime.name;
    return id
      .split(/[-_]/)
      .filter(Boolean)
      .map((part) => part[0].toUpperCase() + part.slice(1))
      .join(' ');
  }, [settings.agentRuntimes]);

  const formatDisplayPath = useCallback((targetPath: string) => {
    if (!targetPath || targetPath.startsWith('~') || !homeDir) return targetPath;
    const normalizedHome = homeDir.replace(/\/$/, '');
    if (targetPath.startsWith(normalizedHome)) {
      const suffix = targetPath.slice(normalizedHome.length);
      return `~${suffix || ''}`;
    }
    return targetPath;
  }, [homeDir]);

  useEffect(() => {
    let cancelled = false;
    if (window.api?.path?.homeDir) {
      window.api.path.homeDir()
        .then((dir) => {
          if (!cancelled) setHomeDir(dir);
        })
        .catch(() => {
          if (!cancelled) setHomeDir(null);
        });
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const loadSkillsFromPath = useCallback(async (skillsPath: string) => {
    setLoading(true);
    try {
      const appSkillsDir = skillsPath || defaultAppSkillsPath;
      const [appSkills, cliSkills] = await Promise.all([
        loadSkillsFromDirectory(appSkillsDir, 'app'),
        (async () => {
          const tools =
            (await window.api?.cliTools?.getAll?.())?.filter(Boolean) ?? [];
          if (!tools.length || !window.api?.path?.homeDir || !window.api?.fs?.exists) {
            return [] as CliSkillGroup[];
          }

          const homeDir = await window.api.path.homeDir();
          const groups: CliSkillGroup[] = [];

          for (const tool of tools as { id: string; displayName?: string }[]) {
            const relativeDir = CLI_SKILL_DIRECTORIES[tool.id];
            if (!relativeDir) continue;
            const dirPath = `${homeDir}/${relativeDir}`;
            const exists = await window.api.fs.exists(dirPath);
            if (!exists) {
              continue;
            }

            const skills = await loadSkillsFromDirectory(dirPath, tool.id);

            groups.push({
              id: tool.id,
              label: tool.displayName || formatCliLabel(tool.id),
              path: dirPath,
              exists: true,
              skills,
            });
          }

          return groups;
        })(),
      ]);

      setSkills(appSkills);
      setCliSkillGroups(cliSkills);
    } catch (err) {
      console.error('[Skills] Failed to load skills:', err);
      setSkills([]);
      setCliSkillGroups([]);
    } finally {
      setLoading(false);
    }
  }, [defaultAppSkillsPath, formatCliLabel]);

  useEffect(() => {
    loadSkillsFromPath(appSkillsPath);
  }, [appSkillsPath, loadSkillsFromPath]);

  const handleRefreshCliGroup = async (group: CliSkillGroup) => {
    try {
      const skills = await loadSkillsFromDirectory(group.path, group.id);
      setCliSkillGroups((prev) =>
        prev.map((item) =>
          item.id === group.id ? { ...item, skills } : item
        )
      );
    } catch (err) {
      console.error('[Skills] Failed to refresh CLI skills:', err);
    }
  };

  const [deleteDialogSkill, setDeleteDialogSkill] = useState<SkillInfo | null>(
    null
  );
  const [deletingSkill, setDeletingSkill] = useState(false);

  const handleDeleteSkill = (skillId: string) => {
    const skill = skills.find((s) => s.id === skillId);
    if (skill) {
      setDeleteDialogSkill(skill);
    }
  };

  const handleConfirmDeleteSkill = async () => {
    if (!deleteDialogSkill) return;
    try {
      setDeletingSkill(true);
      const resolvedPath = await resolvePath(deleteDialogSkill.path);
      if (!window.api?.fs?.stat || !window.api?.fs?.remove) {
        console.error('[Skills] Delete not supported in this environment.');
        return;
      }
      const stats = await window.api.fs.stat(resolvedPath);
      if (!stats.isDirectory) {
        console.error(
          '[Skills] Refusing to delete non-directory skill path:',
          resolvedPath
        );
        return;
      }
      await window.api.fs.remove(resolvedPath, { recursive: true });
      setDeleteDialogSkill(null);
      await loadSkillsFromPath(appSkillsPath);
    } catch (err) {
      console.error('[Skills] Failed to delete skill:', err);
    } finally {
      setDeletingSkill(false);
    }
  };

  if (loading) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center gap-2">
        <Loader2 className="size-4 animate-spin" />
        {t.common.loading}
      </div>
    );
  }

  return (
    <div className="-m-6 flex h-[calc(100%+48px)] flex-col">
      {/* Tab Bar */}
      <div className="border-border shrink-0 border-b px-6">
        <div className="flex items-center gap-6">
          <button
            onClick={() => setMainTab('installed')}
            className={cn(
              'relative py-4 text-sm font-medium transition-colors',
              mainTab === 'installed'
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t.settings.skillsInstalled}
            {mainTab === 'installed' && (
              <span className="bg-foreground absolute bottom-0 left-0 h-0.5 w-full" />
            )}
          </button>
          <button
            onClick={() => setMainTab('cli')}
            className={cn(
              'relative py-4 text-sm font-medium transition-colors',
              mainTab === 'cli'
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t.settings.cli}
            {mainTab === 'cli' && (
              <span className="bg-foreground absolute bottom-0 left-0 h-0.5 w-full" />
            )}
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {mainTab === 'installed' ? (
          /* Installed Tab Content */
          <div className="space-y-6 p-6">
            <div className="border-border bg-background rounded-xl border p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="text-foreground text-sm font-medium">
                    {t.settings.skillsAppDirectory}
                  </h3>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {t.settings.skillsAppDirectoryDescription}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <code className="bg-muted text-muted-foreground block min-w-0 flex-1 truncate rounded px-2 py-1 text-xs">
                      {formatDisplayPath(appSkillsPath)}
                    </code>
                    <button
                      onClick={() => openFolderInSystem(appSkillsPath)}
                      className="text-muted-foreground hover:text-foreground hover:bg-accent inline-flex h-8 w-8 items-center justify-center rounded transition-colors"
                      title={t.settings.skillsOpenFolder}
                    >
                      <FolderOpen className="size-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-border bg-background space-y-3 rounded-xl border p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="text-foreground text-sm font-medium">
                  {t.settings.skillsAppSkills}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => loadSkillsFromPath(appSkillsPath)}
                    className="text-muted-foreground hover:text-foreground hover:bg-accent inline-flex h-7 w-7 items-center justify-center rounded transition-colors"
                    title={t.common.refresh}
                    aria-label={t.common.refresh}
                  >
                    <RefreshCw className="size-3.5" />
                  </button>
                  <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium">
                    {appSkillsSorted.length} {t.settings.skillsList}
                  </span>
                </div>
              </div>

              {appSkillsSorted.length === 0 ? (
                <div className="text-muted-foreground flex h-28 items-center justify-center rounded-lg border border-dashed border-border text-sm">
                  {t.settings.skillsEmpty}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {appSkillsSorted.map((skill) => (
                    <SkillCard
                      key={skill.id}
                      skill={skill}
                      onDelete={() => handleDeleteSkill(skill.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* CLI Tab Content */
          <div className="space-y-4 p-6">
            <div className="space-y-3">

              {cliGroupsVisible.length === 0 ? (
                <div className="text-muted-foreground flex h-28 items-center justify-center rounded-xl border border-dashed border-border text-sm">
                  {t.settings.skillsGlobalEmpty}
                </div>
              ) : (
                <div className="space-y-4">
                  {cliGroupsVisible.map((group) => (
                    <div
                      key={group.id}
                      className="border-border bg-background rounded-xl border p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-foreground text-sm font-medium">
                              {group.label}
                            </h4>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleRefreshCliGroup(group)}
                                className="text-muted-foreground hover:text-foreground hover:bg-accent inline-flex h-7 w-7 items-center justify-center rounded transition-colors"
                                title={t.common.refresh}
                                aria-label={t.common.refresh}
                              >
                                <RefreshCw className="size-3.5" />
                              </button>
                              <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-2 py-0.5 text-xs font-medium">
                                {group.skills.length} {t.settings.skillsList}
                              </span>
                            </div>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <code className="bg-muted text-muted-foreground block min-w-0 flex-1 truncate rounded px-2 py-1 text-xs">
                              {formatDisplayPath(group.path)}
                            </code>
                            <button
                              onClick={() => openFolderInSystem(group.path)}
                              className="text-muted-foreground hover:text-foreground hover:bg-accent inline-flex h-8 w-8 items-center justify-center rounded transition-colors"
                              title={t.settings.skillsOpenFolder}
                            >
                              <FolderOpen className="size-4" />
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                          {group.skills.map((skill) => (
                            <SkillCard
                              key={skill.id}
                              skill={skill}
                              readOnly
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Delete Skill Dialog */}
      {deleteDialogSkill && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setDeleteDialogSkill(null)}
          />
          <div className="bg-background border-border relative z-10 w-[400px] rounded-xl border p-6 shadow-lg">
            <h3 className="text-foreground mb-2 text-base font-semibold">
              {t.settings.skillsDeleteTitle}
            </h3>
            <p className="text-muted-foreground mb-4 text-sm">
              {t.settings.skillsDeleteDescription}
            </p>
            <div className="bg-muted mb-4 rounded-lg p-3">
              <code className="text-foreground text-xs break-all">
                {formatDisplayPath(deleteDialogSkill.path)}
              </code>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteDialogSkill(null)}
                className="border-border hover:bg-accent h-9 rounded-lg border px-4 text-sm transition-colors"
                disabled={deletingSkill}
              >
                {t.common.cancel}
              </button>
              <button
                onClick={handleConfirmDeleteSkill}
                disabled={deletingSkill}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="size-4" />
                {t.common.delete}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import from GitHub Dialog */}
      {showGitHubImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => {
              setShowGitHubImport(false);
              setGithubUrl('');
            }}
          />
          <div className="bg-background border-border relative z-10 w-[420px] rounded-xl border p-6 shadow-lg">
            <button
              onClick={() => {
                setShowGitHubImport(false);
                setGithubUrl('');
              }}
              className="text-muted-foreground hover:text-foreground absolute top-4 right-4"
            >
              <X className="size-5" />
            </button>

            {/* Icons */}
            <div className="mb-4 flex items-center justify-center gap-3">
              <div className="bg-muted flex size-12 items-center justify-center rounded-xl">
                <Github className="size-6" />
              </div>
              <ArrowLeftRight className="text-muted-foreground size-5" />
              <div className="bg-muted flex size-12 items-center justify-center rounded-xl">
                <Layers className="size-6" />
              </div>
            </div>

            <h3 className="text-foreground mb-2 text-center text-lg font-semibold">
              {t.settings.skillsImportGitHub}
            </h3>
            <p className="text-muted-foreground mb-6 text-center text-sm">
              {t.settings.skillsImportGitHubDialogDesc}
            </p>

            <div className="mb-4">
              <label className="text-foreground mb-2 block text-sm font-medium">
                URL
              </label>
              <input
                type="text"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                placeholder="https://github.com/username/repo"
                className="border-input bg-muted text-foreground placeholder:text-muted-foreground focus:ring-ring h-11 w-full rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none"
              />
            </div>

            <button
              onClick={async () => {
                if (!githubUrl) return;
                setImporting(true);
                try {
                  const response = await fetch(
                    `${API_BASE_URL}/files/import-skill`,
                    {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        url: githubUrl,
                        targetDir: appSkillsPath,
                      }),
                    }
                  );
                  const data = await response.json();
                  if (data.success) {
                    setShowGitHubImport(false);
                    setGithubUrl('');
                    // Reload skills
                    loadSkillsFromPath(appSkillsPath);
                  } else {
                    console.error('[Skills] Import failed:', data.error);
                  }
                } catch (err) {
                  console.error('[Skills] Import error:', err);
                } finally {
                  setImporting(false);
                }
              }}
              disabled={!githubUrl || importing}
              className="bg-foreground text-background hover:bg-foreground/90 flex h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              {importing ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t.settings.skillsImporting}
                </>
              ) : (
                t.settings.skillsImport
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
