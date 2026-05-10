# LLMS Generator

> AI 网站理解引擎 - llms.txt / llms.json 自动生成器

## 项目简介

LLMS Generator 是一个基于 Electron + React 的桌面应用，用于自动抓取网站内容、智能过滤分类，并生成符合 LLM（大语言模型）理解的 `llms.txt` 和 `llms.json` 文件。

## 功能特性

### 任务管理
- **新建抓取任务** — 输入网站 URL，配置抓取参数（最大页面数、深度、并发数等）
- **暂停/继续** — 运行中可随时暂停，暂停后可继续执行
- **停止任务** — 停止后状态显示「已停止」，可重新抓取
- **重新抓取** — 在已有数据基础上重新运行，已存在的 URL 自动跳过
- **删除任务** — 删除单个任务及其关联数据
- **清空所有数据** — 一键清除所有任务、抓取数据和生成文件

### 智能抓取
- 基于 Crawlee 的 BFS 广度优先爬取
- 自动解析 sitemap.xml 获取站点链接
- 遵守 robots.txt 协议
- 可配置并发数、请求频率、超时时间、重试次数
- 每个任务使用独立的 RequestQueue，相同 URL 可跨任务抓取
- 同一任务内通过 `UNIQUE(task_id, url_hash)` 数据库约束自动去重

### 内容处理
- 基于 Mozilla Readability 的内容提取
- URL 规则过滤（广告、跟踪、静态资源等）
- 内容质量过滤（最小内容长度、重复检测）
- 基于规则的内容分类（文档、博客、代码、API 参考等）
- 基于规则的重要性评分（代码块、标题数、内容长度等）

### 输出与导出
- **生成 llms.txt** — 纯文本格式，按分类组织页面信息
- **生成 llms.json** — JSON 格式，包含完整的结构化数据
- **导出文件** — 通过系统保存对话框导出到指定位置
- **打开目录** — 快速打开输出文件所在目录
- **复制内容** — 一键复制生成的文本内容

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Electron 33 |
| 构建工具 | electron-vite 3 |
| 前端框架 | React 19 |
| UI 组件 | Ant Design 5 |
| 爬取引擎 | Crawlee 3 |
| 内容提取 | Mozilla Readability + jsdom |
| 数据库 | better-sqlite3 |
| 语言 | TypeScript 5 |

## 快速开始

### 环境要求
- Node.js >= 18
- npm >= 9

### 安装依赖
```bash
cd llms-generator
npm install
```

### 开发模式
```bash
npm run dev
```

### 构建应用
```bash
npm run build
npm run build:win    # 构建 Windows 安装包
```

## 项目结构

```
llms-generator/
├── src/
│   ├── main/                  # Electron 主进程
│   │   ├── db/                # 数据库初始化与迁移
│   │   ├── engine/            # 核心引擎
│   │   │   ├── crawl/         # 爬取引擎（Crawlee）
│   │   │   ├── extract/       # 内容提取（Readability）
│   │   │   ├── output/        # 输出生成（llms.txt/json）
│   │   │   └── rules/         # 过滤与分类规则
│   │   ├── ipc/               # IPC 通信处理器
│   │   └── pipeline/          # 任务流水线
│   ├── preload/               # 预加载脚本
│   ├── renderer/              # React 渲染进程
│   └── shared/                # 共享类型与工具
├── config/                    # 配置文件
│   ├── default.yaml           # 默认配置
│   ├── filter-rules.yaml      # URL 过滤规则
│   └── classify-rules.yaml    # 内容分类规则
├── docs/                      # 项目文档
└── package.json
```

## 数据存储

- **数据库路径**：`%APPDATA%/llms-generator/data/llms-generator.db`（Windows）
- **输出路径**：`%APPDATA%/llms-generator/output/task-{id}-{domain}/`
