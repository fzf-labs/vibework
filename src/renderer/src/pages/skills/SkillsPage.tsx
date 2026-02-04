import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useProjects } from '@/hooks/useProjects';
import { useLanguage } from '@/providers/language-provider';
import { getSettings } from '@/data/settings';
import {
  FolderOpen,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import {
  CLI_SKILL_DIRECTORIES,
  formatCliLabel,
  loadSkillsFromDirectory,
  openFolderInSystem,
  resolvePath,
} from '@/lib/skills';
import type { SkillInfo } from '@/components/settings/types';

interface CliTarget {
  id: string;
  label: string;
  path: string;
}

const joinPath = (basePath: string, segment: string) => {
  const separator = basePath.includes('\\') ? '\\' : '/';
  return `${basePath.replace(/[\\/]+$/, '')}${separator}${segment}`;
};

const getBaseName = (targetPath: string) =>
  targetPath.split(/[\\/]/).filter(Boolean).pop() || targetPath;

interface CliSkillGroup {
  id: string;
  label: string;
  globalPath: string;
  projectPath: string;
  globalSkills: SkillInfo[];
  projectSkills: SkillInfo[];
}

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

  return (
    <div className="border-border bg-background hover:border-foreground/20 relative flex flex-col rounded-xl border p-4 transition-colors">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-foreground text-sm font-medium">
          {skill.name}
        </span>
        <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px] font-medium">
          {skill.source}
        </span>
      </div>

      <p className="text-muted-foreground mb-4 line-clamp-2 flex-1 text-xs">
        {skill.description || t.settings.skillsNoDescription}
      </p>

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
                {!readOnly && onDelete && (
                  <button
                    onClick={() => {
                      onDelete();
                      setShowMenu(false);
                    }}
                    className="hover:bg-destructive/10 text-destructive flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm whitespace-nowrap transition-colors"
                  >
                    <Trash2 className="size-3.5 shrink-0" />
                    {t.settings.skillsDelete}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function SkillsPage() {
  const { t } = useLanguage();
  const { currentProject } = useProjects();
  const [cliGroups, setCliGroups] = useState<CliSkillGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [homeDir, setHomeDir] = useState<string | null>(null);
  const [deleteDialogSkill, setDeleteDialogSkill] = useState<SkillInfo | null>(null);
  const [deletingSkill, setDeletingSkill] = useState(false);
  const [showGlobalImport, setShowGlobalImport] = useState(false);
  const [globalSkills, setGlobalSkills] = useState<SkillInfo[]>([]);
  const [selectedGlobalSkills, setSelectedGlobalSkills] = useState<string[]>([]);
  const [cliTargets, setCliTargets] = useState<CliTarget[]>([]);
  const [selectedCliTargets, setSelectedCliTargets] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  const formatDisplayPath = useCallback(
    (targetPath: string) => {
      if (!targetPath || targetPath.startsWith('~') || !homeDir) return targetPath;
      const normalizedHome = homeDir.replace(/\/$/, '');
      if (targetPath.startsWith(normalizedHome)) {
        const suffix = targetPath.slice(normalizedHome.length);
        return `~${suffix || ''}`;
      }
      return targetPath;
    },
    [homeDir]
  );

  useEffect(() => {
    let cancelled = false;
    if (window.api?.path?.homeDir) {
      window.api.path
        .homeDir()
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

  const loadProjectSkills = useCallback(async () => {
    if (!currentProject?.id || !currentProject?.path) {
      setCliGroups([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const cliTools =
        (await window.api?.cliTools?.getAll?.())?.filter(Boolean) ?? [];
      const fallbackTools = cliTools.length
        ? cliTools
        : [{ id: 'codex', displayName: 'Codex' }];

      const groups: CliSkillGroup[] = [];

      for (const tool of fallbackTools as { id: string; displayName?: string }[]) {
        const relativeDir = CLI_SKILL_DIRECTORIES[tool.id];
        if (!relativeDir) continue;
        const globalPath = `~/${relativeDir}`;
        const projectPath = joinPath(currentProject.path, relativeDir);
        const [globalSkills, projectSkills] = await Promise.all([
          loadSkillsFromDirectory(globalPath, 'global'),
          loadSkillsFromDirectory(projectPath, 'project'),
        ]);
        groups.push({
          id: tool.id,
          label: tool.displayName || formatCliLabel(tool.id),
          globalPath,
          projectPath,
          globalSkills,
          projectSkills,
        });
      }

      setCliGroups(groups);
    } catch (err) {
      console.error('[Skills] Failed to load project skills:', err);
      setCliGroups([]);
    } finally {
      setLoading(false);
    }
  }, [currentProject?.id, currentProject?.path]);

  useEffect(() => {
    void loadProjectSkills();
  }, [loadProjectSkills]);

  const loadGlobalSkills = useCallback(async () => {
    const settings = getSettings();
    const appSkillsPath = settings.skillsPath || '~/.vibework/skills';
    const skills = await loadSkillsFromDirectory(appSkillsPath, 'global');
    setGlobalSkills(skills);
  }, []);

  const loadCliTargets = useCallback(async () => {
    if (!currentProject?.path) {
      setCliTargets([]);
      return;
    }

    const tools =
      (await window.api?.cliTools?.getAll?.())?.filter(Boolean) ?? [];
    const fallbackTools = tools.length ? tools : [{ id: 'codex', displayName: 'Codex' }];
    const targets: CliTarget[] = [];

    for (const tool of fallbackTools as { id: string; displayName?: string }[]) {
      const relativeDir = CLI_SKILL_DIRECTORIES[tool.id];
      if (!relativeDir) continue;
      targets.push({
        id: tool.id,
        label: tool.displayName || formatCliLabel(tool.id),
        path: joinPath(currentProject.path, relativeDir),
      });
    }

    setCliTargets(targets);
  }, [currentProject?.path]);

  const openGlobalImport = useCallback(async () => {
    if (!currentProject?.id) return;
    setSelectedGlobalSkills([]);
    setSelectedCliTargets([]);
    setShowGlobalImport(true);
    await Promise.all([loadGlobalSkills(), loadCliTargets()]);
  }, [currentProject?.id, loadCliTargets, loadGlobalSkills]);

  const handleRefreshGroup = async (
    group: CliSkillGroup,
    scope: 'global' | 'project'
  ) => {
    try {
      if (scope === 'global') {
        const skills = await loadSkillsFromDirectory(group.globalPath, 'global');
        setCliGroups((prev) =>
          prev.map((item) =>
            item.id === group.id ? { ...item, globalSkills: skills } : item
          )
        );
        return;
      }
      const skills = await loadSkillsFromDirectory(group.projectPath, 'project');
      setCliGroups((prev) =>
        prev.map((item) =>
          item.id === group.id ? { ...item, projectSkills: skills } : item
        )
      );
    } catch (err) {
      console.error('[Skills] Failed to refresh project skills:', err);
    }
  };

  const handleConfirmDeleteSkill = async () => {
    if (!deleteDialogSkill || !currentProject?.path) return;
    try {
      setDeletingSkill(true);
      const resolvedPath = await resolvePath(deleteDialogSkill.path);
      const resolvedProjectPath = await resolvePath(currentProject.path);
      if (!resolvedPath.startsWith(resolvedProjectPath)) {
        console.error('[Skills] Refusing to delete skill outside project:', resolvedPath);
        return;
      }
      if (!window.api?.fs?.stat || !window.api?.fs?.remove) {
        console.error('[Skills] Delete not supported in this environment.');
        return;
      }
      const stats = await window.api.fs.stat(resolvedPath);
      if (!stats.isDirectory) {
        console.error('[Skills] Refusing to delete non-directory skill path:', resolvedPath);
        return;
      }
      await window.api.fs.remove(resolvedPath, { recursive: true });
      setDeleteDialogSkill(null);
      await loadProjectSkills();
    } catch (err) {
      console.error('[Skills] Failed to delete project skill:', err);
    } finally {
      setDeletingSkill(false);
    }
  };

  const copyDirectoryRecursive = useCallback(
    async (sourcePath: string, targetPath: string) => {
      if (!window.api?.fs?.readDir || !window.api?.fs?.mkdir) return;
      await window.api.fs.mkdir(targetPath);
      const entries = (await window.api.fs.readDir(sourcePath, {
        maxDepth: 1,
      })) as Array<{ name: string; path: string; isDir: boolean }>;
      for (const entry of entries) {
        const nextTarget = joinPath(targetPath, entry.name);
        if (entry.isDir) {
          await copyDirectoryRecursive(entry.path, nextTarget);
        } else if (window.api?.fs?.readFile && window.api?.fs?.writeFile) {
          const data = await window.api.fs.readFile(entry.path);
          await window.api.fs.writeFile(nextTarget, data);
        }
      }
    },
    []
  );

  const handleImportFromGlobal = useCallback(async () => {
    if (!currentProject?.path) return;
    if (!selectedGlobalSkills.length || !selectedCliTargets.length) return;
    if (!window.api?.fs?.exists) return;

    setImporting(true);
    try {
      const skillsToImport = globalSkills.filter((skill) =>
        selectedGlobalSkills.includes(skill.id)
      );
      const targets = cliTargets.filter((target) =>
        selectedCliTargets.includes(target.id)
      );

      for (const target of targets) {
        await window.api.fs.mkdir(target.path);
        for (const skill of skillsToImport) {
          const skillName = getBaseName(skill.path);
          const destination = joinPath(target.path, skillName);
          const exists = await window.api.fs.exists(destination);
          if (exists) continue;
          await copyDirectoryRecursive(skill.path, destination);
        }
      }

      setShowGlobalImport(false);
      await loadProjectSkills();
    } catch (err) {
      console.error('[Skills] Failed to import skills:', err);
    } finally {
      setImporting(false);
    }
  }, [
    cliTargets,
    copyDirectoryRecursive,
    currentProject?.path,
    globalSkills,
    loadProjectSkills,
    selectedCliTargets,
    selectedGlobalSkills,
  ]);

  if (loading) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center gap-2">
        <Loader2 className="size-4 animate-spin" />
        {t.common.loading}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Skill</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {currentProject ? currentProject.name : '未选择项目'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={loadProjectSkills}
            disabled={!currentProject?.id}
          >
            刷新
          </Button>
          <Button
            onClick={openGlobalImport}
            disabled={!currentProject?.id}
          >
            从全局导入
          </Button>
        </div>
      </div>

      <div className="mt-6 min-h-0 flex-1 overflow-y-auto">
        {!currentProject ? (
          <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/30 p-10 text-center">
          <div className="text-lg font-medium">未选择项目</div>
          <div className="text-muted-foreground mt-2 max-w-md text-sm">
            请选择一个项目以查看或管理项目级 Skills。
          </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-4">
              {cliGroups.length === 0 ? (
                <div className="text-muted-foreground flex h-28 items-center justify-center rounded-xl border border-dashed border-border text-sm">
                  暂无 Skills，可将技能文件放入项目目录后刷新。
                </div>
              ) : (
                cliGroups.map((group) => (
                  <div
                    key={group.id}
                    className="border-border bg-background rounded-xl border p-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-foreground text-sm font-medium">
                        {group.label}
                      </h4>
                      <span className="text-muted-foreground text-xs">
                        全局 {group.globalSkills.length} / 项目 {group.projectSkills.length}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <div className="border-border rounded-lg border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-foreground text-sm font-medium">
                            全局 Skills
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleRefreshGroup(group, 'global')}
                              className="text-muted-foreground hover:text-foreground hover:bg-accent inline-flex h-7 w-7 items-center justify-center rounded transition-colors"
                              title={t.common.refresh}
                              aria-label={t.common.refresh}
                            >
                              <RefreshCw className="size-3.5" />
                            </button>
                            <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-2 py-0.5 text-xs font-medium">
                              {group.globalSkills.length} {t.settings.skillsList}
                            </span>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <code className="bg-muted text-muted-foreground block min-w-0 flex-1 truncate rounded px-2 py-1 text-xs">
                            {formatDisplayPath(group.globalPath)}
                          </code>
                          <button
                            onClick={() => openFolderInSystem(group.globalPath)}
                            className="text-muted-foreground hover:text-foreground hover:bg-accent inline-flex h-8 w-8 items-center justify-center rounded transition-colors"
                            title={t.settings.skillsOpenFolder}
                          >
                            <FolderOpen className="size-4" />
                          </button>
                        </div>
                        <div className="mt-4">
                          {group.globalSkills.length === 0 ? (
                            <div className="text-muted-foreground flex h-20 items-center justify-center rounded-lg border border-dashed border-border text-sm">
                              {t.settings.skillsEmpty}
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 gap-3">
                              {group.globalSkills.map((skill) => (
                                <SkillCard
                                  key={skill.id}
                                  skill={skill}
                                  readOnly
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="border-border rounded-lg border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-foreground text-sm font-medium">
                            Skill
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleRefreshGroup(group, 'project')}
                              className="text-muted-foreground hover:text-foreground hover:bg-accent inline-flex h-7 w-7 items-center justify-center rounded transition-colors"
                              title={t.common.refresh}
                              aria-label={t.common.refresh}
                            >
                              <RefreshCw className="size-3.5" />
                            </button>
                            <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-2 py-0.5 text-xs font-medium">
                              {group.projectSkills.length} {t.settings.skillsList}
                            </span>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <code className="bg-muted text-muted-foreground block min-w-0 flex-1 truncate rounded px-2 py-1 text-xs">
                            {formatDisplayPath(group.projectPath)}
                          </code>
                          <button
                            onClick={() => openFolderInSystem(group.projectPath)}
                            className="text-muted-foreground hover:text-foreground hover:bg-accent inline-flex h-8 w-8 items-center justify-center rounded transition-colors"
                            title={t.settings.skillsOpenFolder}
                          >
                            <FolderOpen className="size-4" />
                          </button>
                        </div>
                        <div className="mt-4">
                          {group.projectSkills.length === 0 ? (
                            <div className="text-muted-foreground flex h-20 items-center justify-center rounded-lg border border-dashed border-border text-sm">
                              {t.settings.skillsEmpty}
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 gap-3">
                              {group.projectSkills.map((skill) => (
                                <SkillCard
                                  key={skill.id}
                                  skill={skill}
                                  onDelete={() => setDeleteDialogSkill(skill)}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

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

      {showGlobalImport && currentProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => {
              setShowGlobalImport(false);
              setSelectedGlobalSkills([]);
              setSelectedCliTargets([]);
            }}
          />
          <div className="bg-background border-border relative z-10 w-[520px] rounded-xl border p-6 shadow-lg">
            <button
              onClick={() => {
                setShowGlobalImport(false);
                setSelectedGlobalSkills([]);
                setSelectedCliTargets([]);
              }}
              className="text-muted-foreground hover:text-foreground absolute top-4 right-4"
            >
              <X className="size-5" />
            </button>

            <h3 className="text-foreground mb-2 text-center text-lg font-semibold">
              从全局导入 Skills
            </h3>
            <p className="text-muted-foreground mb-6 text-center text-sm">
              从全局已安装的 Skills 复制到当前项目的指定 CLI 目录。
            </p>

            <div className="space-y-5">
              <div>
                <div className="text-foreground text-sm font-medium">全局 Skills</div>
                <div className="border-border mt-2 max-h-40 overflow-y-auto rounded-lg border">
                  {globalSkills.length === 0 ? (
                    <div className="text-muted-foreground px-3 py-6 text-center text-sm">
                      暂无全局 Skills
                    </div>
                  ) : (
                    globalSkills.map((skill) => (
                      <label
                        key={skill.id}
                        className="hover:bg-accent flex cursor-pointer items-center gap-2 px-3 py-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={selectedGlobalSkills.includes(skill.id)}
                          onChange={() => {
                            setSelectedGlobalSkills((prev) =>
                              prev.includes(skill.id)
                                ? prev.filter((id) => id !== skill.id)
                                : [...prev, skill.id]
                            );
                          }}
                        />
                        <span className="text-foreground">{skill.name}</span>
                        {skill.description && (
                          <span className="text-muted-foreground text-xs">
                            {skill.description}
                          </span>
                        )}
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div>
                <div className="text-foreground text-sm font-medium">目标 CLI</div>
                <div className="border-border mt-2 max-h-32 overflow-y-auto rounded-lg border">
                  {cliTargets.length === 0 ? (
                    <div className="text-muted-foreground px-3 py-6 text-center text-sm">
                      未找到可用 CLI 目录
                    </div>
                  ) : (
                    cliTargets.map((target) => (
                      <label
                        key={target.id}
                        className="hover:bg-accent flex cursor-pointer items-center gap-2 px-3 py-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={selectedCliTargets.includes(target.id)}
                          onChange={() => {
                            setSelectedCliTargets((prev) =>
                              prev.includes(target.id)
                                ? prev.filter((id) => id !== target.id)
                                : [...prev, target.id]
                            );
                          }}
                        />
                        <span className="text-foreground">{target.label}</span>
                        <span className="text-muted-foreground text-xs">
                          {formatDisplayPath(target.path)}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={handleImportFromGlobal}
              disabled={
                importing ||
                selectedGlobalSkills.length === 0 ||
                selectedCliTargets.length === 0
              }
              className="bg-foreground text-background hover:bg-foreground/90 flex h-11 w-full items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              {importing ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  正在导入...
                </>
              ) : (
                '开始导入'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
