import { CheerioCrawler, RequestQueue } from 'crawlee'
import type { CrawlConfig, ExtractedContent } from '../../../shared/types'
import { SitemapParser } from './sitemap-parser'
import { sendLog, sendProgress, isTaskPaused, isTaskAborted } from '../../ipc/handlers'

export class CrawlEngine {
  private config: CrawlConfig
  private taskId: number
  private results: ExtractedContent[] = []
  private aborted = false

  constructor(taskId: number, config: CrawlConfig) {
    this.taskId = taskId
    this.config = config
  }

  async run(): Promise<ExtractedContent[]> {
    sendLog(this.taskId, `Starting crawl: ${this.config.seedUrl}`)
    sendProgress(this.taskId, { stage: 'discovery', status: 'running' })

    const maxPages = this.config.maxPages
    const seedOrigin = new URL(this.config.seedUrl).origin
    const self = this

    // Step 1: Try sitemap
    let urls = await new SitemapParser().parse(this.config.seedUrl)
    if (urls.length > 0) {
      sendLog(this.taskId, `Found ${urls.length} URLs from sitemap`)
    }

    // Step 2: Build seed URLs list
    const seedUrls: string[] = urls.length > 0 ? urls.slice(0, maxPages) : [this.config.seedUrl]
    sendLog(this.taskId, `Seed URLs: ${seedUrls.length}, URLs: ${JSON.stringify(seedUrls.slice(0, 3))}`)

    // Step 3: Create a unique RequestQueue for this task (avoid Crawlee's cached queue)
    const requestQueue = await RequestQueue.open(`task-${this.taskId}-${Date.now()}`)

    // Add seed URLs to queue
    for (const url of seedUrls) {
      await requestQueue.addRequest({ url })
    }
    sendLog(this.taskId, `RequestQueue initialized with ${seedUrls.length} URLs`)

    // Step 4: BFS crawl
    const crawler = new CheerioCrawler({
      requestQueue,
      maxRequestsPerCrawl: maxPages,
      maxConcurrency: this.config.maxConcurrency,
      maxRequestsPerMinute: this.config.maxRequestsPerMinute,
      requestHandlerTimeoutSecs: Math.floor(this.config.timeout / 1000),
      maxRequestRetries: this.config.retryCount,
      additionalMimeTypes: ['text/html'],

      async requestHandler({ $, request, enqueueLinks }) {
        if (self.aborted) return
        if (isTaskAborted(self.taskId)) {
          self.aborted = true
          return
        }

        // Wait if paused
        while (isTaskPaused(self.taskId)) {
          if (isTaskAborted(self.taskId)) {
            self.aborted = true
            return
          }
          await new Promise(r => setTimeout(r, 500))
        }

        const url = request.url
        sendLog(self.taskId, `Fetched: ${url}`)

        const html = $.html()

        const title = $('title').text().trim()
        const description = $('meta[name="description"]').attr('content')?.trim() || ''
        const h1 = $('h1').first().text().trim()
        const textContent = $('body').text().trim()
        const contentLength = textContent.length

        self.results.push({
          url,
          title,
          description,
          h1,
          headings: [],
          content: html,
          textContent,
          codeBlocks: [],
          links: [],
          contentHash: '',
          lang: $('html').attr('lang') || '',
          siteName: '',
          hasCodeBlock: $('pre code').length > 0,
          headingCount: $('h1,h2,h3,h4,h5,h6').length,
          contentLength
        })

        sendProgress(self.taskId, {
          stage: 'crawl',
          currentUrl: url,
          fetchedPages: self.results.length,
          totalPages: maxPages
        })

        if (self.results.length < maxPages) {
          await enqueueLinks({
            globs: [seedOrigin + '/**']
          })
        }
      },

      failedRequestHandler({ request, error }) {
        const errMsg = error?.message || String(error) || 'Unknown error'
        sendLog(self.taskId, `Failed to fetch: ${request.url} - ${errMsg}`, 'error')
      }
    })

    try {
      await crawler.run()
    } catch (err) {
      sendLog(self.taskId, `Crawler error: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }

    // Cleanup: drop the task-specific queue
    try {
      await requestQueue.drop()
    } catch {
      // Ignore cleanup errors
    }

    sendLog(self.taskId, `Crawl completed. Total pages fetched: ${this.results.length}`)
    return this.results
  }

  abort(): void {
    this.aborted = true
  }
}
