# Left Sidebar Navigation Spec

## Overview

定义左边栏功能导航的行为和交互规范。

## ADDED Requirements

### Requirement: 功能导航区

左边栏 MUST 提供四个主要功能导航入口：Dashboard、看板、Skill、MCP。

#### Scenario: 用户点击 Dashboard 导航项
- Given 用户在任意页面
- When 用户点击左边栏的"Dashboard"导航项
- Then 应导航到 /dashboard 路由
- And Dashboard 导航项应显示为激活状态

#### Scenario: 用户点击看板导航项
- Given 用户在任意页面
- When 用户点击左边栏的"看板"导航项
- Then 应导航到 /board 路由
- And 看板导航项应显示为激活状态

#### Scenario: 用户点击 Skill 导航项
- Given 用户在任意页面
- When 用户点击左边栏的"Skill"导航项
- Then 应导航到 /skills 路由
- And Skill 导航项应显示为激活状态

#### Scenario: 用户点击 MCP 导航项
- Given 用户在任意页面
- When 用户点击左边栏的"MCP"导航项
- Then 应导航到 /mcp 路由
- And MCP 导航项应显示为激活状态

#### Scenario: 用户点击设置按钮
- Given 用户在任意页面
- When 用户点击左边栏底部的"设置"按钮
- Then 应打开设置弹窗
