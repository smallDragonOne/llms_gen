export const IPC_CHANNELS = {
  CRAWL_START: 'crawl:start',
  CRAWL_PAUSE: 'crawl:pause',
  CRAWL_RESUME: 'crawl:resume',
  CRAWL_STOP: 'crawl:stop',
  CRAWL_PROGRESS: 'crawl:progress',
  CRAWL_LOG: 'crawl:log',
  CRAWL_COMPLETE: 'crawl:complete',
  DB_GET_TASKS: 'db:getTasks',
  DB_GET_PAGES: 'db:getPages',
  DB_GET_TASK: 'db:getTask',
  CONFIG_GET: 'config:get',
  CONFIG_SET: 'config:set',
  EXPORT_LLMS: 'export:llms',
  EXPORT_JSON: 'export:json'
} as const
