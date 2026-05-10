# IPC API 接口文档

## Preload API (`window.api`)

渲染进程通过 `window.api` 调用主进程功能。

### 爬取控制

#### `crawlStart(config)`
创建新任务并启动爬取流水线。

```typescript
crawlStart(config: CrawlConfig): Promise<{ taskId: number }>
```

**CrawlConfig 参数：**
| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| seedUrl | string | - | 种子 URL |
| maxDepth | number | 3 | 最大抓取深度 |
| maxPages | number | 10 | 最大页面数 |
| maxConcurrency | number | 2 | 并发数 |
| maxRequestsPerMinute | number | 60 | 每分钟最大请求数 |
| usePlaywright | boolean | false | 是否使用 Playwright 渲染 |
| timeout | number | 30000 | 请求超时（ms） |
| retryCount | number | 3 | 重试次数 |
| respectRobotsTxt | boolean | true | 是否遵守 robots.txt |
| userAgent | string | 'LLMS-Generator/1.0' | User-Agent |

#### `crawlPause(taskId)`
暂停任务。设置暂停信号，CrawlEngine 的 requestHandler 会每 500ms 检查并等待。

```typescript
crawlPause(taskId: number): Promise<{ success: boolean }>
```

#### `crawlResume(taskId)`
继续任务。清除暂停信号。

```typescript
crawlResume(taskId: number): Promise<{ success: boolean }>
```

#### `crawlStop(taskId)`
停止任务。设置中止信号，任务状态改为 `stopped`。

```typescript
crawlStop(taskId: number): Promise<{ success: boolean }>
```

#### `crawlRestart(taskId)`
重新抓取任务。保留已有数据，重新运行 pipeline。已存在的 URL 通过 `INSERT OR IGNORE` 自动跳过。

```typescript
crawlRestart(taskId: number): Promise<{ success: boolean }>
```

### 事件监听

#### `onCrawlProgress(callback)`
监听爬取进度事件。

```typescript
onCrawlProgress(callback: (data: ProgressData) => void): void
```

#### `onCrawlLog(callback)`
监听日志事件。

```typescript
onCrawlLog(callback: (data: LogItem) => void): void
```

#### `removeAllListeners(channel)`
移除指定通道的所有监听器。

```typescript
removeAllListeners(channel: string): void
```

### 数据查询

#### `getTasks()`
获取所有任务列表（snake_case 转 camelCase）。

```typescript
getTasks(): Promise<TaskItem[]>
```

#### `getPages(taskId)`
获取指定任务的页面列表。

```typescript
getPages(taskId: number): Promise<PageRecord[]>
```

#### `getTask(taskId)`
获取单个任务详情。

```typescript
getTask(taskId: number): Promise<TaskItem>
```

#### `deleteTask(taskId)`
删除任务及其关联数据（pages、links、ai_analysis、输出文件）。

```typescript
deleteTask(taskId: number): Promise<{ success: boolean }>
```

#### `clearAllData()`
清空所有数据：删除所有表数据 + 删除 output 目录。

```typescript
clearAllData(): Promise<{ success: boolean }>
```

### 输出与导出

#### `generateOutput(taskId)`
为指定任务生成 llms.txt 和 llms.json 文件。

```typescript
generateOutput(taskId: number): Promise<GenerateOutputResult>
```

**返回值：**
```typescript
interface GenerateOutputResult {
  success: boolean
  outputDir?: string
  llmsTxtPath?: string
  llmsJsonPath?: string
  error?: string
}
```

#### `exportFile(params)`
通过系统保存对话框导出文件到指定位置。

```typescript
exportFile(params: { content: string; defaultName: string }): Promise<{ success: boolean; filePath?: string }>
```

#### `openOutputFolder(outputPath)`
在文件管理器中打开目录。

```typescript
openOutputFolder(outputPath: string): Promise<{ success: boolean }>
```

#### `readLlmsTxt(filePath)` / `readLlmsJson(filePath)`
读取输出文件内容。

```typescript
readLlmsTxt(filePath: string): Promise<ReadFileResult>
readLlmsJson(filePath: string): Promise<ReadFileResult>
```

---

## 数据库表结构

### crawl_tasks（任务表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 任务 ID |
| seed_url | TEXT | 种子 URL |
| status | TEXT | 状态：pending/running/paused/completed/failed/stopped |
| config | TEXT | 抓取配置（JSON） |
| total_pages | INTEGER | 总页面数 |
| fetched_pages | INTEGER | 已抓取页面数 |
| filtered_pages | INTEGER | 已过滤页面数 |
| kept_pages | INTEGER | 保留页面数 |
| error_message | TEXT | 错误信息 |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |
| completed_at | TEXT | 完成时间 |

### pages（页面表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 页面 ID |
| task_id | INTEGER FK | 关联任务 ID |
| url | TEXT | 原始 URL |
| url_normalized | TEXT | 规范化 URL |
| url_hash | TEXT | URL SHA256 哈希 |
| title | TEXT | 页面标题 |
| description | TEXT | 页面描述 |
| content | TEXT | HTML 内容 |
| text_content | TEXT | 纯文本内容 |
| content_hash | TEXT | 内容哈希 |
| category | TEXT | 分类 |
| category_source | TEXT | 分类来源（rule/ai） |
| importance | INTEGER | 重要性评分（0-100） |
| importance_source | TEXT | 评分来源 |
| keep | INTEGER | 是否保留（1/0） |
| ai_reason | TEXT | AI 分析原因 |
| status | TEXT | 页面状态 |
| filter_reason | TEXT | 过滤原因 |
| has_code_block | INTEGER | 是否包含代码块 |
| heading_count | INTEGER | 标题数量 |
| content_length | INTEGER | 内容长度 |
| fetch_time | INTEGER | 抓取耗时（ms） |
| depth | INTEGER | 抓取深度 |
| lang | TEXT | 语言 |
| site_name | TEXT | 站点名称 |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

**唯一约束：** `UNIQUE(task_id, url_hash)` — 同一任务内 URL 唯一，不同任务可以有相同 URL。

### links（链接表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 链接 ID |
| task_id | INTEGER FK | 关联任务 ID |
| from_url | TEXT | 来源 URL |
| to_url | TEXT | 目标 URL |
| anchor_text | TEXT | 锚文本 |

### ai_analysis（AI 分析表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 分析 ID |
| page_id | INTEGER FK | 关联页面 ID |
| category | TEXT | AI 分类 |
| confidence | REAL | 置信度 |
| importance | INTEGER | AI 评分 |
| keep | INTEGER | 是否保留 |
| reason | TEXT | 分析原因 |
| model | TEXT | 使用的模型 |
| tokens_used | INTEGER | Token 消耗 |
| created_at | TEXT | 创建时间 |
