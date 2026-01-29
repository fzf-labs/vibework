## 1. Spec & Data Model
- [ ] 1.1 更新 project-management 规格，补充项目类型与路径校验要求
- [ ] 1.2 数据库迁移：projects 表新增 `project_type` 列并设置默认值
- [ ] 1.3 更新数据库/服务层 Project 类型与映射

## 2. Backend + IPC
- [ ] 2.1 ProjectService 新增路径校验与类型判定接口
- [ ] 2.2 暴露 IPC：点击项目时校验路径存在与项目类型

## 3. Frontend
- [ ] 3.1 新建项目时写入 `project_type`
- [ ] 3.2 点击项目时调用校验接口并提示路径异常
- [ ] 3.3 当类型变化时刷新项目数据

## 4. Validation
- [ ] 4.1 openspec validate add-project-type-tracking --strict --no-interactive
- [ ] 4.2 手动验证：创建普通项目/已有 git 项目/路径不存在提示
