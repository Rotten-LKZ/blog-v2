---
title: 功能测试：Mermaid 图表演练场
description: 用 Pele 渲染各类 Mermaid 图的测试博文
createdAt: 2026-10-24
tags: [测试, Mermaid]
category: 杂谈
toc: true
---

这是一篇测试博文，用来验证各类 Mermaid 图在正文中的渲染效果。以下覆盖常用图型。

## 流程图（Flowchart）

```mermaid
flowchart TD
    A[读者打开博文] --> B{有 Mermaid 代码块?}
    B -->|有| C[加载 Pele]
    B -->|没有| D[正常阅读]
    C --> E{容器宽度}
    E -->|宽| F[横版布局]
    E -->|窄| G[自动竖版]
    F --> H[渲染完成]
    G --> H
    D --> H
```

## 时序图（Sequence）

```mermaid
sequenceDiagram
    participant U as 读者
    participant B as 博客页面
    participant P as Pele
    U->>B: 打开博文
    B->>P: mount(container, 源码)
    P-->>B: SVG
    B-->>U: 展示图表
    Note over P: 语法错误时在容器内显示
```

## 状态图（State）

```mermaid
stateDiagram-v2
    [*] --> 草稿
    草稿 --> 校对: 初稿完成
    校对 --> 发布: 审核通过
    校对 --> 草稿: 需要修改
    发布 --> [*]
```

## 甘特图（Gantt）

```mermaid
gantt
    title 博客改造计划
    dateFormat YYYY-MM-DD
    section 前端
    Mermaid 渲染 :done, 2026-10-23, 1d
    主题适配     :done, 2026-10-24, 1d
    section 后续
    性能观察     :active, 3d
    评论系统     :5d
```

```mermaid
sankey
Electricity grid,Heating and cooling - homes,113.726
Electricity grid,Industry,342.165
Electricity grid,Losses,56.691

```

## 饼图（Pie）

```mermaid
pie showData title 图表类型占比
    "流程图" : 35
    "时序图" : 25
    "状态图" : 20
    "其他" : 20
```

## 类图（Class）

```mermaid
classDiagram
    class BlogPost {
        +String title
        +Date createdAt
        +render()
    }
    class MermaidBlock {
        +String source
        +mount()
    }
    BlogPost "1" --> "0..*" MermaidBlock : 包含
```

## 实体关系图（ER）

```mermaid
erDiagram
    POST ||--o{ TAG : "标记"
    POST ||--o| COVER : "封面"
    POST {
        string title
        date createdAt
    }
```

---

普通 Markdown 元素回归检查：**加粗**、*斜体*、`行内代码`、[链接](https://pele.run)、以及表格：

| 图型 | 状态 |
| --- | --- |
| flowchart | ✅ |
| sequence | ✅ |
| state | ✅ |
| gantt | ✅ |
| pie | ✅ |
| class / er | ✅ |
