# Rotcool 的个人博客 (v2)

基于 Astro 构建的二次元风格、高颜值个人博客。

## 🌟 核心特性

- 🎨 **二次元精致 UI**：悬浮卡片设计、磨砂玻璃效果、径向渐变背景。
- 📱 **响应式布局**：针对大屏优化的瀑布流展示，完美适配手机端。
- 📚 **强大的合集系统**：支持章节规划、自定义标题映射、折叠/展开推荐逻辑。
- 🔍 **多维度检索**：支持按年份（时间轴）、分类、标签进行文章筛选。
- 🛠️ **交互应用栏目**：内置 Vue SPA，支持友链墙、小工具、交互画廊。
- 🌙 **完善的暗色模式**：经过深度优化的配色，确保夜间阅读不刺眼。
- 📡 **RSS & SEO**：全站 SEO 优化，内置 RSS 订阅支持。

## 🚀 快速启动

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 构建项目
pnpm build

# 预览构建效果
pnpm preview
```

## 📂 目录结构说明

```text
├── src/
│   ├── assets/             # 本地静态资源（图片等）
│   ├── components/         # Astro 组件
│   │   ├── vue/            # Vue 交互组件 (App 栏目核心)
│   │   └── ...             # UI 基础组件 (Sidebar, BlogCard 等)
│   ├── content/            # 内容管理 (核心)
│   │   ├── blog/           # 普通文章 (.md, .mdx)
│   │   └── collections/    # 系列合集 (文件夹 + meta.json + md)
│   ├── data/               # 静态 JSON 数据 (如友链)
│   ├── layouts/            # 页面布局模板
│   ├── pages/              # 路由配置 (支持动态路由)
│   └── styles/             # 全局 CSS 样式
├── astro.config.mjs        # Astro 配置文件
├── tsconfig.json           # TS 配置 (已配置 @/ 路径别名)
└── package.json            # 项目依赖
```

## 📝 内容指南

### 1. 撰写普通文章
在 `src/content/blog/` 下创建 `.md` 文件，必须包含以下 Frontmatter：
```yaml
---
title: "文章标题"
description: "文章简述"
createdAt: 2026-03-15
updatedAt: 2026-03-16  # 可选
cover: "@/assets/cover.jpg"  # 可选，若无则不显示封面
tags: ["标签1", "标签2"]
category: "技术"
toc: true  # 是否显示目录
---
```

### 2. 创建系列合集
在 `src/content/collections/` 下创建一个**文件夹**（如 `my-series`），并在内部创建 `meta.json`：
```json
{
  "title": "合集名称",
  "description": "合集描述",
  "category": "技术",
  "tags": ["Astro"],
  "isCollapsed": true,  // 设为 true 则在首页折叠显示为一个封面
  "showTocAbove": true, // 在文章页正文上方显示合集导航
  "structure": [
    {
      "chapterName": "第一章",
      "posts": [
        { "slug": "file1", "title": "自定义显示标题" },
        { "slug": "file2" }
      ]
    }
  ]
}
```

## 🛠️ 技术栈

- **框架**: [Astro 5.0](https://astro.build/) (Content Layer API)
- **前端库**: [Vue 3](https://vuejs.org/) (用于交互模块)
- **样式**: Vanilla CSS (CSS Variables + CSS Columns 瀑布流)
- **类型安全**: TypeScript
- **图标**: 内置 SVG 系统

## 🔧 自定义配置

大部分全局配置（如站长信息、导航菜单）可以在 `src/consts.ts` 中直接修改。
友链信息存放在 `src/data/friends.json` 中。
