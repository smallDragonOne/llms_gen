export const DEFAULT_CONFIG = {
  crawl: {
    maxDepth: 3,
    maxPages: 500,
    maxConcurrency: 10,
    maxRequestsPerMinute: 60,
    usePlaywright: false,
    timeout: 30000,
    retryCount: 3,
    respectRobotsTxt: true,
    userAgent: 'LLMS-Generator/1.0'
  },
  ai: {
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4o-mini',
    maxTokens: 500,
    batchSize: 10,
    timeout: 30000,
    temperature: 0.1
  },
  filter: {
    minContentLength: 100,
    maxContentLength: 100000,
    deduplicateThreshold: 0.85
  },
  output: {
    format: ['llms-txt', 'llms-json', 'site-knowledge-json'],
    maxPagesPerCategory: 50
  }
}

export const IPC_CHANNELS = {
  // Crawl
  CRAWL_START: 'crawl:start',
  CRAWL_PAUSE: 'crawl:pause',
  CRAWL_RESUME: 'crawl:resume',
  CRAWL_STOP: 'crawl:stop',
  CRAWL_PROGRESS: 'crawl:progress',
  CRAWL_LOG: 'crawl:log',
  CRAWL_COMPLETE: 'crawl:complete',
  // DB
  DB_GET_TASKS: 'db:getTasks',
  DB_GET_PAGES: 'db:getPages',
  DB_GET_TASK: 'db:getTask',
  // Config
  CONFIG_GET: 'config:get',
  CONFIG_SET: 'config:set',
  // Export
  EXPORT_LLMS: 'export:llms',
  EXPORT_JSON: 'export:json'
} as const
