# 变更记录

## v1.0.0

### 新增功能

- **任务管理**
  - 新建抓取任务，配置 URL、最大页面数、深度、并发数
  - 暂停/继续任务（基于内存信号 + 500ms 轮询）
  - 停止任务（状态显示「已停止」而非「失败」）
  - 重新抓取（保留已有数据，已存在 URL 自动跳过）
  - 删除单个任务（独立 Modal 确认弹窗）
  - 清空所有数据（清除数据库 + 输出文件）
  - 新建任务时自动清空表单

- **智能爬取**
  - 基于 Crawlee CheerioCrawler 的 BFS 广度优先爬取
  - 自动解析 sitemap.xml
  - 每个任务独立 RequestQueue（`task-{id}-{timestamp}`），支持跨任务相同 URL 抓取
  - 同任务内数据库级 URL 去重 `UNIQUE(task_id, url_hash)`
  - 遵守 robots.txt 协议

- **内容处理**
  - Mozilla Readability 内容提取
  - URL 规则过滤（基于 filter-rules.yaml）
  - 内容质量过滤（最小内容长度）
  - 基于规则的内容分类和重要性评分

- **输出与导出**
  - 生成 llms.txt（纯文本格式）
  - 生成 llms.json（JSON 格式）
  - 导出 txt/json 到用户指定位置（系统保存对话框）
  - 打开输出目录
  - 复制生成内容到剪贴板

- **UI 交互**
  - 任务列表 + 任务详情双栏布局
  - 实时进度条和日志显示
  - 已抓取 URL 列表
  - 输出文件预览（Tabs 切换 txt/json）
  - 任务状态标签（运行中/已暂停/已停止/已完成/失败/等待中）
  - 2 秒轮询刷新任务状态

### 技术实现

- **框架**：Electron 33 + React 19 + Ant Design 5 + TypeScript 5
- **构建**：electron-vite 3
- **数据库**：better-sqlite3，WAL 模式，自动迁移
- **爬取**：Crawlee 3 CheerioCrawler
- **内容提取**：Mozilla Readability + jsdom

### 已知限制

- 暂停/继续基于轮询机制（500ms 间隔），非精确暂停
- 停止任务后正在处理的请求会完成当前页面后才停止
- AI 分析功能预留接口但未完全实现
- Playwright JS 渲染模式预留但未完全实现
