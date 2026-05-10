// ==================== Crawl ====================
export interface CrawlConfig {
  seedUrl: string
  maxDepth: number
  maxPages: number
  maxConcurrency: number
  maxRequestsPerMinute: number
  usePlaywright: boolean
  timeout: number
  retryCount: number
  respectRobotsTxt: boolean
  userAgent: string
}

// ==================== Page ====================
export interface ExtractedContent {
  url: string
  title: string
  description: string
  h1: string
  headings: Heading[]
  content: string
  textContent: string
  codeBlocks: string[]
  links: Link[]
  contentHash: string
  lang: string
  siteName: string
  hasCodeBlock: boolean
  headingCount: number
  contentLength: number
}

export interface Heading {
  level: number
  text: string
}

export interface Link {
  href: string
  text: string
}

// ==================== Filter & Classify ====================
export interface FilterResult {
  filtered: boolean
  reason?: string
}

export interface ClassifyResult {
  category: string
  confidence: number
  source: 'rule' | 'ai'
}

// ==================== AI ====================
export interface AIConfig {
  baseUrl: string
  apiKey: string
  model: string
  maxTokens: number
  batchSize: number
  timeout: number
  temperature: number
}

export interface AIAnalysisResult {
  category: string
  confidence: number
  importance: number
  keep: boolean
  reason: string
}

// ==================== Task ====================
export type TaskStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed'
export type PageStatus = 'pending' | 'fetched' | 'filtered' | 'analyzed' | 'kept' | 'discarded'

export interface CrawlTask {
  id: number
  seedUrl: string
  status: TaskStatus
  config: string
  totalPages: number
  fetchedPages: number
  filteredPages: number
  keptPages: number
  errorMessage: string | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

export interface PageRecord {
  id: number
  taskId: number
  url: string
  urlNormalized: string
  urlHash: string
  title: string | null
  description: string | null
  content: string | null
  textContent: string | null
  contentHash: string | null
  category: string
  categorySource: string
  importance: number
  importanceSource: string
  keep: number
  aiReason: string | null
  status: PageStatus
  filterReason: string | null
  hasCodeBlock: number
  headingCount: number
  contentLength: number
  fetchTime: number | null
  depth: number
  lang: string | null
  siteName: string | null
  createdAt: string
  updatedAt: string
}

// ==================== Output ====================
export interface CategoryNode {
  name: string
  count: number
  pages: PageSummary[]
}

export interface PageSummary {
  url: string
  title: string
  description: string
  category: string
  importance: number
  keep: boolean
}

// ==================== IPC ====================
export interface ProgressEvent {
  type: 'progress' | 'log' | 'page' | 'complete' | 'error'
  taskId: number
  data: Record<string, unknown>
}

export interface AppConfig {
  crawl: {
    maxDepth: number
    maxPages: number
    maxConcurrency: number
    maxRequestsPerMinute: number
    usePlaywright: boolean
    timeout: number
    retryCount: number
    respectRobotsTxt: boolean
    userAgent: string
  }
  ai: AIConfig
  filter: {
    minContentLength: number
    maxContentLength: number
    deduplicateThreshold: number
  }
  output: {
    format: string[]
    maxPagesPerCategory: number
  }
}
