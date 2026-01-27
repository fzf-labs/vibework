# Project Switcher Spec

## Overview

定义项目切换器的行为和交互规范。

## ADDED Requirements

### Requirement: 项目切换器显示

项目切换器 MUST 显示在左边栏底部，展示当前项目信息。

#### Scenario: 显示当前项目
- Given 用户已选择一个项目
- When 左边栏渲染完成
- Then 项目切换器应显示当前项目名称
- And 应显示展开/收起指示器

#### Scenario: 无项目时显示
- Given 用户未选择任何项目
- When 左边栏渲染完成
- Then 项目切换器应显示"选择项目"提示文本

### Requirement: 项目列表展开

用户 MUST 能够展开项目列表进行切换。

#### Scenario: 展开项目列表
- Given 用户已有多个项目
- When 用户点击项目切换器
- Then 应展开下拉菜单显示所有项目
- And 当前项目应有选中标记

#### Scenario: 切换项目
- Given 项目列表已展开
- When 用户点击另一个项目
- Then 应切换到该项目
- And 下拉菜单应关闭
- And 全局项目上下文应更新

### Requirement: 创建新项目

用户 MUST 能够从项目切换器创建新项目。

#### Scenario: 打开创建项目对话框
- Given 项目列表已展开
- When 用户点击"新建项目"选项
- Then 应打开项目创建对话框
