import type { CrawlConfig } from '../shared/types'

interface ProgressEvent {
  taskId: number
  stage: string
  status: string
  currentUrl?: string
  fetchedPages?: number
  totalPages?: number
  filteredPages?: number
  progress?: number
}

interface LogEvent {
  taskId: number
  message: string
  level: string
  timestamp: number
}

interface CrawlStartResult {
  taskId: number
}

interface GenerateOutputResult {
  success: boolean
  outputDir?: string
  llmsTxtPath?: string
  llmsJsonPath?: string
  error?: string
}

interface ReadFileResult {
  success: boolean
  content?: string
  error?: string
}

interface Api {
  // Crawl
  crawlStart: (config: CrawlConfig) => Promise<CrawlStartResult>
  crawlPause: (taskId: number) => Promise<{ success: boolean }>
  crawlResume: (taskId: number) => Promise<{ success: boolean }>
  crawlStop: (taskId: number) => Promise<{ success: boolean }>
  crawlRestart: (taskId: number) => Promise<{ success: boolean }>
  onCrawlProgress: (callback: (data: ProgressEvent) => void) => void
  onCrawlLog: (callback: (data: LogEvent) => void) => void
  onCrawlComplete: (callback: (data: any) => void) => void

  // DB
  getTasks: () => Promise<any[]>
  getPages: (taskId: number) => Promise<any[]>
  getTask: (taskId: number) => Promise<any>
  deleteTask: (taskId: number) => Promise<{ success: boolean }>
  clearAllData: () => Promise<{ success: boolean }>

  // Config
  getConfig: () => Promise<any>
  setConfig: (config: Record<string, unknown>) => Promise<{ success: boolean }>

  // Output
  generateOutput: (taskId: number) => Promise<GenerateOutputResult>
  openOutputFolder: (outputPath: string) => Promise<{ success: boolean }>
  readLlmsTxt: (filePath: string) => Promise<ReadFileResult>
  readLlmsJson: (filePath: string) => Promise<ReadFileResult>
  exportFile: (params: { content: string; defaultName: string }) => Promise<{ success: boolean; filePath?: string }>

  // Utils
  removeAllListeners: (channel: string) => void
}

declare global {
  interface Window {
    api: Api
  }
}
