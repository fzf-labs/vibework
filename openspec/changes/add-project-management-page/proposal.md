# Change: add project management page and lock when no projects

## Why
项目管理目前散落在左侧项目下拉菜单中，操作入口不集中且易误触。需要一个专门的项目管理页面，并在无项目时强制引导创建。

## What Changes
- 新增项目管理页面路由 `/projects`，集中处理项目的增删改查
- 左侧项目切换器仅保留“选择项目”，移除打开文件夹/删除/新建项目等入口
- 在项目切换器右侧新增小型“设置/管理”按钮，进入项目管理页面
- 应用启动时若无项目，强制跳转并锁定在项目管理页面直到创建至少一个项目

## Impact
- Affected specs: `project-switcher`, `project-management`
- Affected code: router, left sidebar project switcher UI, project CRUD UI, app startup guards
- Breaking: none (UI behavior change)
