# 前端样式指南 (Frontend Style Guide)

> 本文档记录项目前端 UI 设计规范、主题色、组件样式约定等。

## 1. 主题色板 (Analog Lab Theme Palette)

项目采用深色工业风格主题，基于 Zinc 色系与高亮橙色。

### 核心变量定义

| 类别 | 变量名 | 色值 (Hex/RGB) | 备注 |
| :--- | :--- | :--- | :--- |
| **背景色** | `--bg-color` | `#18181b` | 主背景色 (Zinc-950) |
| | `--panel-bg` | `#27272a` | 面板背景色 (Zinc-900) |
| | `--panel-header-bg` | `#3f3f46` | 面板标题栏背景色 (Zinc-800) |
| **边框色** | `--border-color` | `#52525b` | 通用边框色 (Zinc-600) |
| **文字颜色** | `--text-primary` | `#e4e4e7` | 主要文字 (Zinc-200) |
| | `--text-secondary` | `#a1a1aa` | 次要文字 (Zinc-400) |
| | `--text-dim` | `#71717a` | 暗淡/提示文字 |
| **强调色 (橙色系)** | `--accent-color` | `#f97316` | **主强调色** (Orange-500) |
| | `--accent-hover` | `#fb923c` | 悬停状态 |
| | `--accent-active` | `#ea580c` | 激活/按下状态 |
| **状态色** | `--accent-success` | `#22c55e` | 成功 (Green) |
| | `--accent-warning` | `#f59e0b` | 警告 (Amber) |
| | `--accent-error` | `#ef4444` | 错误 (Red) |
| **选中状态** | `--selection-bg` | `rgba(249, 115, 22, 0.2)` | 选中背景 (透明橙色) |
| | `--selection-border` | `#f97316` | 选中边框 |

### 辅助样式变量

| 变量名 | 值 | 用途 |
| :--- | :--- | :--- |
| `--header-height` | `56px` | 顶部应用栏高度 |
| `--sidebar-width` | `280px` | 左侧资源树宽度 |
| `--inspector-width` | `340px` | 右侧属性面板宽度 |
| `--radius-sm` | `4px` | 小圆角 |
| `--radius-md` | `6px` | 中圆角 |
| `--shadow-sm` | `0 1px 2px rgba...` | 小阴影 |
| `--shadow-md` | `0 4px 6px rgba...` | 悬浮阴影 |
