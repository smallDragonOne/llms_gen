import React, { useState, useEffect, useCallback } from 'react'
import { Button, Input, InputNumber, Card, Tag, Space, Modal, Form, Switch, Typography, Progress, Tabs, message, List, Tooltip, App as AntApp } from 'antd'
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  StopOutlined,
  PlusOutlined,
  GlobalOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
  FolderOpenOutlined,
  CopyOutlined,
  FileOutlined,
  ThunderboltOutlined,
  ClockCircleOutlined,
  FilterOutlined,
  ArrowRightOutlined,
  DeleteOutlined,
  ClearOutlined,
  DownloadOutlined
} from '@ant-design/icons'

const { Sider, Content } = Typography
const { Text, Title } = Typography

interface TaskItem {
  id: number
  seedUrl: string
  status: string
  totalPages: number
  fetchedPages: number
  filteredPages: number
  keptPages: number
  errorMessage: string | null
  createdAt: string
}

interface LogItem {
  taskId: number
  message: string
  level: string
  timestamp: number
}

interface ProgressData {
  taskId: number
  stage: string
  status: string
  currentUrl?: string
  fetchedPages?: number
  totalPages?: number
  filteredPages?: number
  progress?: number
}

interface CrawledUrl {
  url: string
  timestamp: number
  status: 'success' | 'pending' | 'failed'
}

interface OutputInfo {
  outputDir: string
  llmsTxtPath: string
  llmsJsonPath: string
}

const getDomainName = (url: string): string => {
  try { return new URL(url).hostname.replace('www.', '') } catch { return url }
}

const formatDateTime = (dateStr: string): string => {
  if (!dateStr || dateStr === 'Invalid Date') return '--'
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return dateStr
    return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch { return dateStr }
}

const styles = {
  layout: {
    height: '100vh',
    display: 'flex',
    background: '#fbfbfd',
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif'
  } as React.CSSProperties,
  sidebar: {
    width: 300,
    minWidth: 300,
    borderRight: '1px solid rgba(0,0,0,0.06)',
    display: 'flex',
    flexDirection: 'column' as const,
    background: '#fbfbfd'
  } as React.CSSProperties,
  sidebarHeader: {
    padding: '20px 20px 16px',
    borderBottom: '1px solid rgba(0,0,0,0.06)'
  } as React.CSSProperties,
  sidebarTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: '#86868b',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    marginBottom: 12
  } as React.CSSProperties,
  taskList: {
    flex: 1,
    overflow: 'auto',
    padding: '8px 12px'
  } as React.CSSProperties,
  taskCard: (isSelected: boolean) => ({
    padding: '12px 14px',
    borderRadius: 12,
    marginBottom: 4,
    cursor: 'pointer',
    transition: 'all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)',
    background: isSelected ? 'rgba(0, 113, 227, 0.06)' : 'transparent',
    borderLeft: isSelected ? '3px solid #0071e3' : '3px solid transparent',
  }) as React.CSSProperties,
  mainContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden'
  } as React.CSSProperties,
  mainHeader: {
    padding: '16px 32px',
    borderBottom: '1px solid rgba(0,0,0,0.06)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: '#fbfbfd'
  } as React.CSSProperties,
  mainBody: {
    flex: 1,
    overflow: 'auto',
    padding: '24px 32px'
  } as React.CSSProperties,
  statItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 13,
    color: '#86868b'
  } as React.CSSProperties,
  statValue: {
    color: '#1d1d1f',
    fontWeight: 600,
    fontSize: 13
  } as React.CSSProperties,
  emptyState: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: 12
  } as React.CSSProperties,
  logLine: (level: string) => ({
    color: level === 'error' ? '#ff453a' : level === 'warn' ? '#ff9f0a' : '#86868b',
    fontFamily: '"SF Mono", "Fira Code", monospace',
    fontSize: 12,
    lineHeight: '20px',
    marginBottom: 2
  }) as React.CSSProperties,
  outputPre: {
    background: '#f5f5f7',
    padding: 16,
    borderRadius: 12,
    maxHeight: 280,
    overflow: 'auto',
    fontSize: 12,
    fontFamily: '"SF Mono", "Fira Code", monospace',
    lineHeight: '20px',
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-all' as const,
    color: '#1d1d1f'
  } as React.CSSProperties,
  generateBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 20px',
    background: '#f5f5f7',
    borderRadius: 12,
    marginBottom: 20
  } as React.CSSProperties,
  urlItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '6px 12px',
    borderRadius: 8,
    fontSize: 12,
    transition: 'background 0.15s ease'
  } as React.CSSProperties
}

const App: React.FC = () => {
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null)
  const [logs, setLogs] = useState<LogItem[]>([])
  const [progress, setProgress] = useState<ProgressData | null>(null)
  const [crawledUrls, setCrawledUrls] = useState<CrawledUrl[]>([])
  const [outputInfo, setOutputInfo] = useState<OutputInfo | null>(null)
  const [llmsTxtContent, setLlmsTxtContent] = useState<string>('')
  const [llmsJsonContent, setLlmsJsonContent] = useState<string>('')
  const [generating, setGenerating] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()
  const [messageApi, contextHolder] = message.useMessage()

  const currentTaskStatus = selectedTask?.status || 'pending'
  const isRunning = currentTaskStatus === 'running'
  const isPaused = currentTaskStatus === 'paused'
  const isCompleted = currentTaskStatus === 'completed' || currentTaskStatus === 'failed' || currentTaskStatus === 'stopped'
  const hasData = !!(selectedTask && selectedTask.fetchedPages > 0)

  // Debug log
  useEffect(() => {
    if (selectedTask) {
      // removed
    }
  }, [selectedTask])

  // Load tasks on mount
  useEffect(() => {
    window.api.getTasks().then((data: TaskItem[]) => setTasks(data))
  }, [])

  // Refresh selected task periodically
  useEffect(() => {
    if (!selectedTask) return
    const timer = setInterval(() => {
      window.api.getTasks().then((data: TaskItem[]) => {
        setTasks(data)
        const updated = data.find((t: TaskItem) => t.id === selectedTask.id)
        if (updated && updated.status !== selectedTask.status) {
          setSelectedTask(updated)
        }
      })
    }, 2000)
    return () => clearInterval(timer)
  }, [selectedTask?.id])

  // Listen for progress
  useEffect(() => {
    const handler = (data: ProgressData) => {
      setProgress(data)
      if (data.currentUrl) {
        setCrawledUrls((prev: CrawledUrl[]) => {
          if (prev.some((u) => u.url === data.currentUrl)) return prev
          return [...prev, { url: data.currentUrl!, timestamp: Date.now(), status: 'success' }]
        })
      }
    }
    window.api.onCrawlProgress(handler)
    return () => window.api.removeAllListeners('crawl:progress')
  }, [])

  // Listen for logs
  useEffect(() => {
    const handler = (data: LogItem) => {
      setLogs((prev: LogItem[]) => [...prev, data])
    }
    window.api.onCrawlLog(handler)
    return () => window.api.removeAllListeners('crawl:log')
  }, [])

  const handleStartCrawl = useCallback(async () => {
    try {
      const values = await form.validateFields()
      const config = {
        seedUrl: values.url, maxDepth: values.maxDepth || 3, maxPages: values.maxPages || 10,
        maxConcurrency: values.concurrency || 2, maxRequestsPerMinute: 60,
        usePlaywright: values.usePlaywright || false, timeout: 30000, retryCount: 3,
        respectRobotsTxt: true, userAgent: 'LLMS-Generator/1.0'
      }
      const result = await window.api.crawlStart(config)
      setModalOpen(false); setLogs([]); setProgress(null); setCrawledUrls([])
      setOutputInfo(null); setLlmsTxtContent(''); setLlmsJsonContent('')
      messageApi.success('任务已启动')
      window.api.getTasks().then((data: TaskItem[]) => {
        setTasks(data)
        const t = data.find((t: TaskItem) => t.id === result.taskId)
        if (t) setSelectedTask(t)
      })
    } catch { messageApi.error('启动任务失败') }
  }, [form, messageApi])

  const handlePause = useCallback(async () => {
    if (!selectedTask) return
    await window.api.crawlPause(selectedTask.id)
    messageApi.info('任务已暂停')
    window.api.getTasks().then((d: TaskItem[]) => { setTasks(d); const u = d.find((t: TaskItem) => t.id === selectedTask.id); if (u) setSelectedTask(u) })
  }, [selectedTask, messageApi])

  const handleResume = useCallback(async () => {
    if (!selectedTask) return
    await window.api.crawlResume(selectedTask.id)
    messageApi.success('任务已继续')
    window.api.getTasks().then((d: TaskItem[]) => { setTasks(d); const u = d.find((t: TaskItem) => t.id === selectedTask.id); if (u) setSelectedTask(u) })
  }, [selectedTask, messageApi])

  const handleStop = useCallback(async () => {
    if (!selectedTask) return
    await window.api.crawlStop(selectedTask.id)
    messageApi.warning('任务已停止')
    window.api.getTasks().then((d: TaskItem[]) => { setTasks(d); const u = d.find((t: TaskItem) => t.id === selectedTask.id); if (u) setSelectedTask(u) })
  }, [selectedTask, messageApi])

  const handleRestart = useCallback(async () => {
    if (!selectedTask) return
    try {
      await window.api.crawlRestart(selectedTask.id)
      setLogs([]); setProgress(null); setCrawledUrls([])
      setOutputInfo(null); setLlmsTxtContent(''); setLlmsJsonContent('')
      messageApi.success('任务已重新抓取')
      window.api.getTasks().then((d: TaskItem[]) => { setTasks(d); const u = d.find((t: TaskItem) => t.id === selectedTask.id); if (u) setSelectedTask(u) })
    } catch { messageApi.error('重新抓取失败') }
  }, [selectedTask, messageApi])

  const handleGenerate = useCallback(async () => {
    if (!selectedTask) return
    setGenerating(true)
    try {
      const result = await window.api.generateOutput(selectedTask.id)
      if (result.success && result.outputDir) {
        setOutputInfo({ outputDir: result.outputDir, llmsTxtPath: result.llmsTxtPath || '', llmsJsonPath: result.llmsJsonPath || '' })
        messageApi.success('llms 文件已生成')
        if (result.llmsTxtPath) { const r = await window.api.readLlmsTxt(result.llmsTxtPath); if (r.success && r.content) setLlmsTxtContent(r.content) }
        if (result.llmsJsonPath) { const r = await window.api.readLlmsJson(result.llmsJsonPath); if (r.success && r.content) setLlmsJsonContent(r.content) }
      } else { messageApi.error(result.error || '生成失败') }
    } catch { messageApi.error('生成失败') } finally { setGenerating(false) }
  }, [selectedTask, messageApi])

  const handleOpenFolder = useCallback(() => { if (outputInfo?.outputDir) window.api.openOutputFolder(outputInfo.outputDir) }, [outputInfo])
  const handleCopyTxt = useCallback(() => { if (llmsTxtContent) { navigator.clipboard.writeText(llmsTxtContent); messageApi.success('已复制') } }, [llmsTxtContent, messageApi])
  const handleCopyJson = useCallback(() => { if (llmsJsonContent) { navigator.clipboard.writeText(llmsJsonContent); messageApi.success('已复制') } }, [llmsJsonContent, messageApi])

  const handleExportTxt = useCallback(async () => {
    if (!llmsTxtContent) return
    try {
      const result = await window.api.exportFile({ content: llmsTxtContent, defaultName: 'llms.txt' })
      if (result.success) messageApi.success('导出成功')
    } catch { messageApi.error('导出失败') }
  }, [llmsTxtContent, messageApi])

  const handleExportJson = useCallback(async () => {
    if (!llmsJsonContent) return
    try {
      const result = await window.api.exportFile({ content: llmsJsonContent, defaultName: 'llms.json' })
      if (result.success) messageApi.success('导出成功')
    } catch { messageApi.error('导出失败') }
  }, [llmsJsonContent, messageApi])

  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [taskToDelete, setTaskToDelete] = useState<number | null>(null)

  const handleDeleteTask = useCallback((taskId: number) => (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setTaskToDelete(taskId)
    setDeleteModalOpen(true)
  }, [])

  const handleDeleteConfirm = useCallback(async () => {
    if (taskToDelete === null) return
    try {
      await window.api.deleteTask(taskToDelete)
      messageApi.success('任务已删除')
      if (selectedTask?.id === taskToDelete) {
        setSelectedTask(null)
        setLogs([]); setProgress(null); setCrawledUrls([])
        setOutputInfo(null); setLlmsTxtContent(''); setLlmsJsonContent('')
      }
      const data = await window.api.getTasks()
      setTasks(data as TaskItem[])
      setDeleteModalOpen(false)
      setTaskToDelete(null)
    } catch (err) {
      console.error('Delete failed:', err)
      messageApi.error('删除失败')
    }
  }, [taskToDelete, selectedTask, messageApi])

  const [clearModalOpen, setClearModalOpen] = useState(false)

  const handleClearAll = useCallback(() => {
    setClearModalOpen(true)
  }, [tasks.length])

  const handleClearConfirm = useCallback(async () => {
    try {
      await window.api.clearAllData()
      messageApi.success('所有数据已清空')
      setSelectedTask(null)
      setLogs([]); setProgress(null); setCrawledUrls([])
      setOutputInfo(null); setLlmsTxtContent(''); setLlmsJsonContent('')
      const data = await window.api.getTasks()
      setTasks(data as TaskItem[])
      setClearModalOpen(false)
    } catch (err) {
      console.error('Clear all failed:', err)
      messageApi.error('清空失败')
    }
  }, [messageApi])

  const statusTag = (status: string) => {
    const map: Record<string, { color: string; label: string }> = {
      running: { color: '#5e5ce6', label: '运行中' },
      completed: { color: '#30d158', label: '已完成' },
      failed: { color: '#ff453a', label: '失败' },
      stopped: { color: '#ff9f0a', label: '已停止' },
      paused: { color: '#ff9f0a', label: '已暂停' },
      pending: { color: '#aeaeb2', label: '等待中' }
    }
    const info = map[status] || map.pending
    return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, color: info.color }}>
      {status === 'running' && <LoadingOutlined spin style={{ fontSize: 10 }} />}
      {info.label}
    </span>
  }

  const resetSelection = (task: TaskItem) => {
    setSelectedTask(task); setLogs([]); setProgress(null); setCrawledUrls([])
    setOutputInfo(null); setLlmsTxtContent(''); setLlmsJsonContent('')
  }

  return (
    <div style={styles.layout}>
      {contextHolder}

      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <div style={styles.sidebarTitle}>任务列表</div>
          <Button type="primary" icon={<PlusOutlined />} block size="large" onClick={() => { form.resetFields(); setModalOpen(true) }}>
            新建任务
          </Button>
        </div>
        <div style={styles.taskList}>
          {tasks.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#aeaeb2', fontSize: 13 }}>
              暂无任务
            </div>
          ) : tasks.map((task: TaskItem) => (
            <div key={task.id} style={styles.taskCard(selectedTask?.id === task.id)} onClick={() => resetSelection(task)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text strong style={{ fontSize: 14, color: '#1d1d1f' }}>{getDomainName(task.seedUrl)}</Text>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {statusTag(task.status)}
                  <Button 
                    type="text" 
                    size="small" 
                    icon={<DeleteOutlined style={{ fontSize: 12, color: '#aeaeb2' }} />} 
                    onClick={handleDeleteTask(task.id)}
                    style={{ padding: '2px 4px', height: 'auto' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#aeaeb2' }}>
                <span><ClockCircleOutlined style={{ marginRight: 3 }} />{formatDateTime(task.createdAt)}</span>
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 11 }}>
                <span style={{ color: '#86868b' }}>抓取 <b style={{ color: '#1d1d1f' }}>{task.fetchedPages}</b></span>
                <span style={{ color: '#86868b' }}>保留 <b style={{ color: '#1d1d1f' }}>{task.keptPages}</b></span>
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
          <Button 
            danger 
            icon={<ClearOutlined />} 
            block 
            onClick={handleClearAll()}
            disabled={tasks.length === 0}
          >
            清空所有数据 ({tasks.length})
          </Button>
        </div>
      </aside>

      {/* Main */}
      <main style={styles.mainContent}>
        {selectedTask ? (
          <>
            {/* Header */}
            <div style={styles.mainHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <Text style={{ fontSize: 20, fontWeight: 600, color: '#1d1d1f' }}>{getDomainName(selectedTask.seedUrl)}</Text>
                {statusTag(selectedTask.status)}
              </div>
              <Space>
                {isRunning && (
                  <>
                    <Button icon={<PauseCircleOutlined />} onClick={handlePause}>暂停</Button>
                    <Button danger icon={<StopOutlined />} onClick={handleStop}>停止</Button>
                  </>
                )}
                {isPaused && (
                  <>
                    <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleResume}>继续</Button>
                    <Button danger icon={<StopOutlined />} onClick={handleStop}>停止</Button>
                  </>
                )}
                {(isCompleted || isPaused) && hasData && (
                  <Button type="primary" icon={<FileOutlined />} onClick={handleGenerate} loading={generating}>
                    生成 llms 文件
                  </Button>
                )}
                {(currentTaskStatus === 'stopped' || currentTaskStatus === 'failed') && (
                  <Button icon={<PlayCircleOutlined />} onClick={handleRestart}>重新抓取</Button>
                )}
                {isCompleted && selectedTask.status === 'failed' && selectedTask.errorMessage && (
                  <Text style={{ fontSize: 13, color: '#ff453a' }}>{selectedTask.errorMessage}</Text>
                )}
              </Space>
            </div>

            {/* Stats Bar */}
            <div style={{ padding: '16px 32px', display: 'flex', gap: 32, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              <div style={styles.statItem}>
                <ThunderboltOutlined style={{ color: '#5e5ce6' }} />
                <span>阶段</span>
                <span style={styles.statValue}>{progress?.stage || 'idle'}</span>
              </div>
              <div style={styles.statItem}>
                <GlobalOutlined style={{ color: '#0071e3' }} />
                <span>已抓取</span>
                <span style={styles.statValue}>{progress?.fetchedPages || selectedTask.fetchedPages}</span>
              </div>
              <div style={styles.statItem}>
                <FilterOutlined style={{ color: '#ff9f0a' }} />
                <span>已过滤</span>
                <span style={styles.statValue}>{progress?.filteredPages || 0}</span>
              </div>
              {progress?.progress !== undefined && (
                <div style={{ flex: 0, marginLeft: 'auto' }}>
                  <Progress percent={progress.progress} size="small" style={{ width: 120 }} />
                </div>
              )}
            </div>

            {/* Body */}
            <div style={styles.mainBody}>
              {/* Generate Bar - show when task has data */}
              {hasData && (
                <div style={styles.generateBar}>
                  <Button type="primary" icon={<FileOutlined />} onClick={handleGenerate} loading={generating}>
                    生成 llms 文件
                  </Button>
                  {outputInfo && (
                    <>
                      <Button icon={<DownloadOutlined />} onClick={handleExportTxt}>导出 txt</Button>
                      <Button icon={<DownloadOutlined />} onClick={handleExportJson}>导出 json</Button>
                      <Button icon={<FolderOpenOutlined />} onClick={handleOpenFolder}>打开目录</Button>
                      <Text style={{ fontSize: 12, color: '#aeaeb2', marginLeft: 4 }}>
                        {outputInfo.outputDir}
                      </Text>
                    </>
                  )}
                </div>
              )}

              {/* Output Preview */}
              {outputInfo && (llmsTxtContent || llmsJsonContent) && (
                <Card size="small" style={{ marginBottom: 20 }} title={<span style={{ fontSize: 13, fontWeight: 600 }}>输出预览</span>}>
                  <Tabs size="small" items={[
                    { key: 'txt', label: 'llms.txt', children: (
                      <div>
                        <div style={{ marginBottom: 8 }}><Button size="small" type="text" icon={<CopyOutlined />} onClick={handleCopyTxt}>复制</Button></div>
                        <pre style={styles.outputPre}>{llmsTxtContent}</pre>
                      </div>
                    )},
                    { key: 'json', label: 'llms.json', children: (
                      <div>
                        <div style={{ marginBottom: 8 }}><Button size="small" type="text" icon={<CopyOutlined />} onClick={handleCopyJson}>复制</Button></div>
                        <pre style={{ ...styles.outputPre, whiteSpace: 'pre' as const }}>{llmsJsonContent}</pre>
                      </div>
                    )}
                  ]} />
                </Card>
              )}

              {/* Content Tabs */}
              <Card size="small" style={{ background: 'transparent', border: 'none', boxShadow: 'none' }}>
                <Tabs defaultActiveKey="urls" items={[
                  {
                    key: 'urls',
                    label: <span>抓取列表 <span style={{ color: '#aeaeb2', fontWeight: 400 }}>({crawledUrls.length})</span></span>,
                    children: (
                      <div style={{ maxHeight: 320, overflow: 'auto', background: '#fff', borderRadius: 12, border: '1px solid rgba(0,0,0,0.06)', padding: '4px 0' }}>
                        {crawledUrls.length === 0 ? (
                          <div style={{ padding: 40, textAlign: 'center', color: '#aeaeb2', fontSize: 13 }}>
                            {isRunning ? '等待抓取...' : '暂无抓取记录'}
                          </div>
                        ) : crawledUrls.map((item: CrawledUrl, i: number) => (
                          <div key={i} style={styles.urlItem}>
                            <CheckCircleOutlined style={{ color: '#30d158', fontSize: 11 }} />
                            <Text ellipsis style={{ flex: 1, fontSize: 12, color: '#1d1d1f' }}>{item.url}</Text>
                            <Text style={{ fontSize: 11, color: '#aeaeb2', flexShrink: 0 }}>
                              {new Date(item.timestamp).toLocaleTimeString()}
                            </Text>
                          </div>
                        ))}
                      </div>
                    )
                  },
                  {
                    key: 'logs',
                    label: <span>日志 <span style={{ color: '#aeaeb2', fontWeight: 400 }}>({logs.length})</span></span>,
                    children: (
                      <div style={{ maxHeight: 320, overflow: 'auto', background: '#1d1d1f', borderRadius: 12, padding: '12px 16px' }}>
                        {logs.length === 0 ? (
                          <div style={{ padding: 40, textAlign: 'center', color: '#86868b', fontSize: 13 }}>暂无日志</div>
                        ) : logs.map((log: LogItem, i: number) => (
                          <div key={i} style={styles.logLine(log.level)}>
                            <span style={{ color: '#5e5ce6' }}>[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}{log.message}
                          </div>
                        ))}
                      </div>
                    )
                  }
                ]} />
              </Card>
            </div>
          </>
        ) : (
          <div style={styles.emptyState}>
            <GlobalOutlined style={{ fontSize: 48, color: '#aeaeb2' }} />
            <Title level={4} type="secondary" style={{ color: '#aeaeb2', fontWeight: 500, marginTop: 0 }}>
              选择或创建任务开始使用
            </Title>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalOpen(true) }}>
              新建任务
            </Button>
          </div>
        )}
      </main>

      {/* Modal */}
      <Modal title="新建抓取任务" open={modalOpen} onOk={handleStartCrawl} onCancel={() => setModalOpen(false)} okText="开始抓取" cancelText="取消" centered width={440}>
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item name="url" label="网站 URL" rules={[{ required: true, message: '请输入网站地址' }]}>
            <Input placeholder="https://example.com" size="large" />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="maxPages" label="最大页面数" initialValue={10}>
              <InputNumber min={1} max={10000} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="maxDepth" label="最大深度" initialValue={3}>
              <InputNumber min={1} max={10} style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="concurrency" label="并发数" initialValue={2}>
              <InputNumber min={1} max={50} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="usePlaywright" label="JS 渲染" valuePropName="checked" initialValue={false}>
              <Switch />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      {/* Clear All Confirm Modal */}
      <Modal
        title="确认清空所有数据"
        open={clearModalOpen}
        onOk={handleClearConfirm}
        onCancel={() => setClearModalOpen(false)}
        okText="清空"
        okButtonProps={{ danger: true }}
        cancelText="取消"
        centered
      >
        <p>此操作将删除所有任务、抓取数据和生成的文件，且不可恢复。</p>
        <p>确定要继续吗？</p>
      </Modal>

      {/* Delete Task Confirm Modal */}
      <Modal
        title="确认删除任务"
        open={deleteModalOpen}
        onOk={handleDeleteConfirm}
        onCancel={() => { setDeleteModalOpen(false); setTaskToDelete(null) }}
        okText="删除"
        okButtonProps={{ danger: true }}
        cancelText="取消"
        centered
      >
        <p>删除任务将同时删除所有相关数据和输出文件，此操作不可恢复。</p>
        <p>确定要删除吗？</p>
      </Modal>
    </div>
  )
}

export default App
