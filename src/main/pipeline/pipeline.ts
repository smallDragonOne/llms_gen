import type { CrawlConfig, ExtractedContent, PageRecord } from '../../shared/types'
import { CrawlEngine } from '../engine/crawl/crawl-engine'
import { ContentExtractor } from '../engine/extract/content-extractor'
import { FilterEngine } from '../engine/rules/filter-engine'
import { ClassifyEngine } from '../engine/rules/classify-engine'
import { getDatabase } from '../db/database'
import { sendLog, sendProgress, isTaskPaused, isTaskAborted } from '../ipc/handlers'
import { LlmsTxtGenerator } from '../engine/output/llms-txt-generator'
import { LlmsJsonGenerator } from '../engine/output/llms-json-generator'
import { snakeToCamelArray } from '../../shared/utils'
import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import { app, shell } from 'electron'

export interface GenerateOutputResult {
  success: boolean
  outputDir?: string
  llmsTxtPath?: string
  llmsJsonPath?: string
  error?: string
}

export async function runPipeline(taskId: number, config: CrawlConfig): Promise<void> {
  const db = getDatabase()
  const startTime = Date.now()

  try {
    // Stage 1: Crawl
    sendProgress(taskId, { stage: 'crawl', status: 'running', progress: 0 })
    sendLog(taskId, 'Stage 1: Starting web crawl...')

    // Wait if task is paused before starting
    await waitForResume(taskId)

    const crawlEngine = new CrawlEngine(taskId, config)
    const rawPages = await crawlEngine.run()

    sendLog(taskId, `Crawl engine returned ${rawPages.length} pages`)
    if (rawPages.length === 0) {
      sendLog(taskId, 'No pages crawled, skipping extraction', 'warn')
      db.prepare(`
        UPDATE crawl_tasks SET status = 'completed', total_pages = 0, fetched_pages = 0, filtered_pages = 0, completed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?
      `).run(taskId)
      sendProgress(taskId, { stage: 'complete', status: 'done' })
      return
    }

    db.prepare("UPDATE crawl_tasks SET total_pages = ? WHERE id = ?").run(rawPages.length, taskId)
    sendLog(taskId, `Crawled ${rawPages.length} pages`)

    // Stage 2: Extract & Filter
    sendProgress(taskId, { stage: 'extract', status: 'running', progress: 0 })
    sendLog(taskId, 'Stage 2: Extracting content and filtering...')

    const contentExtractor = new ContentExtractor()
    const filterEngine = new FilterEngine({ minContentLength: config.maxPages ? 100 : 100 })
    const classifyEngine = new ClassifyEngine()

    let fetchedCount = 0
    let filteredCount = 0

    const insertPage = db.prepare(`
      INSERT OR IGNORE INTO pages (task_id, url, url_normalized, url_hash, title, description,
        content, text_content, content_hash, category, category_source, importance,
        importance_source, keep, status, filter_reason, has_code_block, heading_count,
        content_length, fetch_time, depth, lang, site_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const insertLink = db.prepare(`
      INSERT INTO links (task_id, from_url, to_url, anchor_text) VALUES (?, ?, ?, ?)
    `)

    const transaction = db.transaction(() => {
      for (const rawPage of rawPages) {
        // URL filter
        const urlFilter = filterEngine.shouldFilterUrl(rawPage.url)
        if (urlFilter.filtered) {
          sendLog(taskId, `URL filtered: ${rawPage.url} - ${urlFilter.reason}`, 'warn')
          filteredCount++
          continue
        }

        // Full content extraction
        const content = contentExtractor.extract(rawPage.content, rawPage.url)

        // Content filter
        const contentFilter = filterEngine.shouldFilterContent(content)
        if (contentFilter.filtered) {
          sendLog(taskId, `Content filtered: ${rawPage.url} - ${contentFilter.reason}`, 'warn')
          filteredCount++
          continue
        }

        // URL normalization
        const urlNormalized = normalizeUrl(rawPage.url)
        const urlHash = crypto.createHash('sha256').update(urlNormalized).digest('hex')

        // Rule-based classification (reference only)
        const classifyResult = classifyEngine.classify(rawPage.url)

        // Rule-based scoring
        const importance = calculateRuleScore(content, classifyResult)

        const result = insertPage.run(
          taskId, rawPage.url, urlNormalized, urlHash,
          content.title, content.description,
          content.content, content.textContent, content.contentHash,
          classifyResult.category, classifyResult.source,
          importance, 'rule',
          importance >= 60 ? 1 : 0,
          importance >= 60 ? 'kept' : 'discarded',
          null,
          content.hasCodeBlock ? 1 : 0,
          content.headingCount,
          content.contentLength,
          Date.now() - startTime,
          0, content.lang, content.siteName
        )

        // Only count if actually inserted (not duplicate)
        if (result.changes > 0) {
          fetchedCount++
        } else {
          sendLog(taskId, `Insert skipped (duplicate?): ${rawPage.url} - changes: ${result.changes}`, 'warn')
        }

        // Store links
        for (const link of content.links) {
          try {
            const linkUrl = new URL(link.href, rawPage.url).href
            insertLink.run(taskId, rawPage.url, linkUrl, link.text)
          } catch {
            // Skip invalid URLs
          }
        }

        if (fetchedCount % 50 === 0) {
          sendProgress(taskId, {
            stage: 'extract',
            progress: Math.round((fetchedCount / rawPages.length) * 100),
            fetchedPages: fetchedCount,
            filteredPages: filteredCount
          })
        }
      }
    })

    transaction()

    sendLog(taskId, `Transaction completed. fetchedCount: ${fetchedCount}, filteredCount: ${filteredCount}, rawPages: ${rawPages.length}`)

    db.prepare(
      'UPDATE crawl_tasks SET fetched_pages = ?, filtered_pages = ?, kept_pages = ?, updated_at = datetime(\'now\') WHERE id = ?'
    ).run(fetchedCount, filteredCount, fetchedCount, taskId)

    sendLog(taskId, `Extracted ${fetchedCount} pages, filtered ${filteredCount} pages`)

    // Stage 3: Generate output
    const outputResult = await generateOutput(taskId, config.seedUrl)
    if (outputResult.success) {
      sendLog(taskId, `Output files saved to: ${outputResult.outputDir}`)
    } else {
      sendLog(taskId, `Failed to generate output: ${outputResult.error}`, 'error')
    }

    // Complete
    db.prepare(`
      UPDATE crawl_tasks SET status = 'completed', completed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?
    `).run(taskId)

    sendProgress(taskId, { stage: 'complete', status: 'done' })
    sendLog(taskId, `Pipeline completed in ${((Date.now() - startTime) / 1000).toFixed(1)}s`)
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    db.prepare("UPDATE crawl_tasks SET status = 'failed', error_message = ?, updated_at = datetime('now') WHERE id = ?").run(
      errMsg,
      taskId
    )
    sendLog(taskId, `Pipeline failed: ${errMsg}`, 'error')
    throw error
  }
}

/**
 * Generate llms.txt and llms.json output files for a task
 */
export async function generateOutput(taskId: number, seedUrl: string): Promise<GenerateOutputResult> {
  try {
    const db = getDatabase()
    
    // Get kept pages
    const keptPages = db
      .prepare('SELECT * FROM pages WHERE task_id = ? AND keep = 1 ORDER BY importance DESC')
      .all(taskId)

    if (keptPages.length === 0) {
      return { success: false, error: 'No pages to generate output from' }
    }

    const keptPagesTyped = snakeToCamelArray<PageRecord>(keptPages as Record<string, unknown>[])

    // Generate llms.txt
    const llmsTxt = new LlmsTxtGenerator()
    const llmsTxtContent = llmsTxt.generate(keptPagesTyped, seedUrl)

    // Generate llms.json
    const llmsJson = new LlmsJsonGenerator()
    const llmsJsonContent = llmsJson.generate(keptPagesTyped, seedUrl)

    // Write output files
    const outputDir = path.join(app.getPath('userData'), 'output')
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }
    
    const domain = new URL(seedUrl).hostname.replace('www.', '')
    const taskOutputDir = path.join(outputDir, `task-${taskId}-${domain}`)
    if (!fs.existsSync(taskOutputDir)) {
      fs.mkdirSync(taskOutputDir, { recursive: true })
    }

    const llmsTxtPath = path.join(taskOutputDir, 'llms.txt')
    const llmsJsonPath = path.join(taskOutputDir, 'llms.json')

    fs.writeFileSync(llmsTxtPath, llmsTxtContent, 'utf-8')
    fs.writeFileSync(llmsJsonPath, llmsJsonContent, 'utf-8')

    return {
      success: true,
      outputDir: taskOutputDir,
      llmsTxtPath,
      llmsJsonPath
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * Open output folder in file explorer
 */
export function openOutputFolder(outputPath: string): void {
  shell.openPath(outputPath)
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url)
    // Remove hash and tracking params
    u.hash = ''
    const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid', 'ref']
    for (const param of trackingParams) {
      u.searchParams.delete(param)
    }
    // Remove trailing slash
    let result = u.toString()
    if (result.endsWith('/')) result = result.slice(0, -1)
    return result
  } catch {
    return url
  }
}

function calculateRuleScore(content: ExtractedContent, classify: { category: string; confidence: number }): number {
  let score = 50 // base score

  // Category bonus
  const highValue = ['文档', 'API参考', '教程']
  if (highValue.includes(classify.category)) score += 30
  if (classify.category === '代码') score += 20
  if (classify.category === '博客') score += 10

  // Content features
  if (content.hasCodeBlock) score += 20
  if (content.headingCount > 5) score += 10
  if (content.contentLength > 2000) score += 10
  if (content.contentLength > 5000) score += 5

  // Penalty
  if (content.contentLength < 200) score -= 20

  return Math.max(0, Math.min(100, score))
}

/**
 * Wait for task to resume if paused. Checks every 500ms.
 * Returns immediately if task is aborted.
 */
function waitForResume(taskId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!isTaskPaused(taskId)) {
      resolve()
      return
    }
    sendLog(taskId, 'Task paused, waiting to resume...')
    const interval = setInterval(() => {
      if (isTaskAborted(taskId)) {
        clearInterval(interval)
        reject(new Error('Task aborted'))
        return
      }
      if (!isTaskPaused(taskId)) {
        clearInterval(interval)
        sendLog(taskId, 'Task resumed')
        resolve()
      }
    }, 500)
  })
}
