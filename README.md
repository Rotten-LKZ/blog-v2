# Rotcool 的个人博客 (v2)

基于 Astro 构建的二次元风格、高颜值个人博客。

## 🌟 核心特性

- 🎨 **二次元精致 UI**：悬浮卡片设计、磨砂玻璃效果、径向渐变背景。
- 📱 **响应式布局**：宽屏可扩展的文章卡片、限制正文图片高度以减少滚动距离，并适配手机端。
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

## 本地内容管理

运行 `pnpm admin`，在本机打开 `http://127.0.0.1:4322`。管理服务仅监听本机，不会包含在公开博客构建中；不要通过公网代理暴露该端口。

端口被占用时可运行 `ADMIN_PORT=4333 pnpm admin`，并访问对应端口。

- 「文章」可新建、编辑、删除普通文章及合集文章；左侧列表选择文章，编辑区域左边实时预览 Markdown，右边编辑源码。保存时自动写入首次 `createdAt` 和本次 `updatedAt`，无需手动填写。
- 在文章源码中输入 `album:` 可选择现有相册图片引用；输入 `@` 可搜索并插入 `src/components/` 下的组件及 MDX import。组件仅支持 `.mdx` 文章；预览显示 Markdown 内容，组件交互及 Astro 特有渲染请在博客开发服务器中检查。
- 「合集」编辑 `meta.json` 的标题、描述与 `structure` 章节顺序；先创建合集，再新建指定合集 ID 的文章，随后在章节 `posts` 中填入文章 slug。
- 「相册」管理嵌套相册及每张图片的 ID、标题、描述、URL；改动后点击「保存相册」。相册目录仍保留在 `src/data/albums.ts`，各相册的图片列表分别放在 `src/data/images/` 下的独立文件中。

管理工具直接修改仓库文件，请将文章、合集及相册数据纳入版本控制。正式站点仍通过 `pnpm build` 静态生成。

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

### 3. 横向图片集

需要将多张相册图片放在同一横向滚动区域时，将文章保存为 `.mdx`，在 frontmatter 后导入组件：

```mdx
import ImageBatch from '../../../components/ImageBatch.astro';

<ImageBatch images={[
  { src: 'album:travel/japan/2025/ukiyoe-1', alt: '浮世绘体验 - 1' },
  { src: 'album:travel/japan/2025/ukiyoe-2', alt: '浮世绘体验 - 2' },
]} />
```

导入路径按文章所在目录调整。图片加载时使用 `/info/` 接口提供的尺寸设置比例；接口不可用时使用图片自身尺寸。鼠标悬停时滚轮横向滚动，到达边缘后恢复页面滚动，也可直接拖动滚动条或使用键盘操作。

## 🛠️ 技术栈

- **框架**: [Astro 7](https://astro.build/) (Content Layer API)
- **前端库**: [Vue 3](https://vuejs.org/) (用于交互模块)
- **样式**: Vanilla CSS (CSS Variables + CSS Columns 瀑布流)
- **类型安全**: TypeScript
- **图标**: 内置 SVG 系统

## 🔧 自定义配置

大部分全局配置（如站长信息、导航菜单）可以在 `src/consts.ts` 中直接修改。
友链信息存放在 `src/data/friends.json` 中。
