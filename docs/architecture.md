# 系统架构设计

## 整体架构

```
┌─────────────────────────────────────────────────────┐
│                   Electron Main Process              │
│                                                      │
│  ┌──────────┐   ┌──────────┐   ┌──────────────────┐ │
│  │   IPC     │──▶│ Pipeline │──▶│   CrawlEngine    │ │
│  │ Handlers │   │          │   │   (Crawlee)       │ │
│  └──────────┘   └────┬─────┘   └──────────────────┘ │
│                      │                               │
│                      ▼                               │
│  ┌──────────────────────────────────────────────┐   │
│  │              Processing Pipeline               │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐  │   │
│  │  │ Content  │ │  Filter  │ │  Classify    │  │   │
│  │  │ Extractor│ │  Engine  │ │  Engine      │  │   │
│  │  └──────────┘ └──────────┘ └──────────────┘  │   │
│  └──────────────────────────────────────────────┘   │
│                      │                               │
│                      ▼                               │
│  ┌──────────┐   ┌──────────┐   ┌──────────────────┐ │
│  │   DB     │◀──│  SQLite  │   │  Output Generator │ │
│  │ (pages)  │   │          │   │  (txt/json)       │ │
│  └──────────┘   └──────────┘   └──────────────────┘ │
└─────────────────────────────────────────────────────┘
         ▲                              │
         │ IPC (ipcRenderer.invoke)     │ IPC Events
         │                              ▼
┌─────────────────────────────────────────────────────┐
│              Electron Renderer Process               │
│  ┌──────────────────────────────────────────────┐   │
│  │              React + Ant Design UI            │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐  │   │
│  │  │  Task    │ │  Task    │ │   Output     │  │   │
│  │  │  List    │ │  Detail  │ │   Preview    │  │   │
│  │  └──────────┘ └──────────┘ └──────────────┘  │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

## 模块说明

### 1. IPC Handlers (`src/main/ipc/handlers.ts`)

主进程与渲染进程的通信桥梁，注册所有 IPC 通道处理器。

**任务控制信号：**
- `taskPaused: Map<number, boolean>` — 记录每个任务的暂停状态
- `taskAborted: Map<number, boolean>` — 记录每个任务的中止状态
- 暂停时设置信号，CrawlEngine 的 requestHandler 每 500ms 轮询检查

**注册的 IPC 通道：**

| 通道 | 说明 |
|------|------|
| `crawl:start` | 创建新任务并启动 pipeline |
| `crawl:pause` | 暂停任务（设置暂停信号） |
| `crawl:resume` | 继续任务（清除暂停信号） |
| `crawl:stop` | 停止任务（设置中止信号，状态改为 stopped） |
| `crawl:restart` | 重新抓取（保留已有数据，重新运行 pipeline） |
| `db:getTasks` | 获取所有任务列表 |
| `db:getPages` | 获取任务的页面列表 |
| `db:getTask` | 获取单个任务详情 |
| `task:delete` | 删除任务及关联数据 |
| `data:clearAll` | 清空所有数据和输出文件 |
| `output:generate` | 生成 llms.txt/json |
| `output:openFolder` | 打开输出目录 |
| `output:readTxt` | 读取 llms.txt 内容 |
| `output:readJson` | 读取 llms.json 内容 |
| `output:exportFile` | 导出文件到指定位置 |

### 2. Pipeline (`src/main/pipeline/pipeline.ts`)

任务执行的核心流水线，按顺序执行三个阶段：

```
Stage 1: 网页爬取 (CrawlEngine)
    ↓
Stage 2: 内容提取 + 过滤 + 分类 + 入库
    ↓
Stage 3: 生成输出文件 (llms.txt / llms.json)
```

**暂停/继续机制：**
- `waitForResume(taskId)` — 暂停时每 500ms 轮询等待恢复
- 中止时抛出错误终止 pipeline

**数据入库：**
- 使用 `INSERT OR IGNORE` + `UNIQUE(task_id, url_hash)` 实现同任务内 URL 去重
- 不同任务可以有相同的 URL

### 3. CrawlEngine (`src/main/engine/crawl/crawl-engine.ts`)

基于 Crawlee `CheerioCrawler` 的爬取引擎。

**关键设计：**
- 每个任务创建独立的 `RequestQueue`（名称：`task-{taskId}-{timestamp}`），避免跨任务 URL 去重
- 爬取完成后 `requestQueue.drop()` 清理队列
- requestHandler 中检查暂停/中止信号
- BFS 广度优先，优先抓取种子页面链接

### 4. ContentExtractor (`src/main/engine/extract/content-extractor.ts`)

基于 Mozilla Readability 的内容提取器。

### 5. FilterEngine (`src/main/engine/rules/filter-engine.ts`)

URL 和内容过滤引擎，基于 YAML 规则配置。

### 6. ClassifyEngine (`src/main/engine/rules/classify-engine.ts`)

基于规则的内容分类引擎。

### 7. Output Generator (`src/main/engine/output/`)

- `llms-txt-generator.ts` — 生成 llms.txt 纯文本格式
- `llms-json-generator.ts` — 生成 llms.json JSON 格式

### 8. Database (`src/main/db/database.ts`)

基于 better-sqlite3 的数据库管理。

**数据迁移：**
- 自动检测并执行 `UNIQUE(url_hash)` → `UNIQUE(task_id, url_hash)` 迁移
- 迁移前清理残留的 `pages_new` 表

## 数据流

```
用户输入 URL
    ↓
创建任务记录 (crawl_tasks)
    ↓
CrawlEngine 爬取网页 → 返回 ExtractedContent[]
    ↓
ContentExtractor 提取正文
    ↓
FilterEngine 过滤低质量内容
    ↓
ClassifyEngine 分类 + 评分
    ↓
INSERT OR IGNORE INTO pages (去重入库)
    ↓
生成 llms.txt / llms.json 到 output 目录
    ↓
更新任务状态为 completed
```

## 前端状态管理

React 组件使用 `useState` + `useCallback` 管理状态。

**任务状态轮询：**
- 每 2 秒从数据库获取最新任务状态
- 状态变化时更新 `selectedTask`，触发按钮重新渲染

**事件监听：**
- `crawl:progress` — 更新进度条和已抓取 URL 列表
- `crawl:log` — 追加日志消息

**按钮显示逻辑：**

| 任务状态 | 显示按钮 |
|---------|---------|
| `running` | 暂停、停止 |
| `paused` | 继续、停止、生成 llms |
| `completed` | 生成 llms |
| `stopped` | 重新抓取、生成 llms（如有数据） |
| `failed` | 重新抓取、生成 llms（如有数据） |
