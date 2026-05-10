import { ipcMain, BrowserWindow, shell, app, dialog } from 'electron'
import { getDatabase } from '../db/database'
import { runPipeline, generateOutput, openOutputFolder } from '../pipeline/pipeline'
import type { CrawlConfig, PageRecord, CrawlTask, AppConfig } from '../../shared/types'
import { DEFAULT_CONFIG } from '../../shared/constants'
import { snakeToCamel, snakeToCamelArray } from '../../shared/utils'
import * as fs from 'fs'
import { join } from 'path'

const { existsSync, rmSync } = fs

// Task control signals
const taskPaused = new Map<number, boolean>()
const taskAborted = new Map<number, boolean>()

export function isTaskPaused(taskId: number): boolean {
  return taskPaused.get(taskId) === true
}

export function isTaskAborted(taskId: number): boolean {
  return taskAborted.get(taskId) === true
}

export function registerIpcHandlers(): void {
  // Get all tasks
  ipcMain.handle('db:getTasks', () => {
    const db = getDatabase()
    const rows = db.prepare('SELECT * FROM crawl_tasks ORDER BY created_at DESC').all()
    return snakeToCamelArray<CrawlTask>(rows as Record<string, unknown>[])
  })

  // Get pages for a task
  ipcMain.handle('db:getPages', (_event, taskId: number) => {
    const db = getDatabase()
    const rows = db
      .prepare('SELECT * FROM pages WHERE task_id = ? ORDER BY importance DESC')
      .all(taskId)
    return snakeToCamelArray<PageRecord>(rows as Record<string, unknown>[])
  })

  // Get single task
  ipcMain.handle('db:getTask', (_event, taskId: number) => {
    const db = getDatabase()
    const row = db.prepare('SELECT * FROM crawl_tasks WHERE id = ?').get(taskId)
    return row ? snakeToCamel<CrawlTask>(row as Record<string, unknown>) : undefined
  })

  // Start crawl
  ipcMain.handle('crawl:start', async (_event, config: CrawlConfig) => {
    const db = getDatabase()
    
    // Clean URL: remove backticks, quotes, whitespace
    const cleanUrl = config.seedUrl
      .replace(/[`'"]/g, '')
      .trim()
    
    // Validate URL
    try {
      new URL(cleanUrl)
    } catch {
      throw new Error(`Invalid URL: ${config.seedUrl}`)
    }
    
    const cleanConfig = { ...config, seedUrl: cleanUrl }
    
    const result = db
      .prepare('INSERT INTO crawl_tasks (seed_url, status, config) VALUES (?, ?, ?)')
      .run(cleanUrl, 'running', JSON.stringify(cleanConfig))

    const taskId = result.lastInsertRowid as number

    // Run pipeline in background
    runPipeline(taskId, cleanConfig).catch((err) => {
      db.prepare('UPDATE crawl_tasks SET status = ?, error_message = ? WHERE id = ?').run(
        'failed',
        err.message,
        taskId
      )
    })

    return { taskId }
  })

  // Restart crawl: re-run pipeline for existing task, skip existing URLs
  ipcMain.handle('crawl:restart', async (_event, taskId: number) => {
    const db = getDatabase()

    // Get task config
    const task = db.prepare('SELECT config, seed_url FROM crawl_tasks WHERE id = ?').get(taskId) as { config: string; seed_url: string } | undefined
    if (!task) throw new Error('Task not found')

    const config: CrawlConfig = JSON.parse(task.config)

    // Reset task status (keep existing data)
    db.prepare("UPDATE crawl_tasks SET status = 'running', error_message = NULL, completed_at = NULL, updated_at = datetime('now') WHERE id = ?").run(taskId)

    // Reset control signals
    taskPaused.set(taskId, false)
    taskAborted.set(taskId, false)

    // Run pipeline in background (INSERT OR IGNORE will skip existing URLs)
    runPipeline(taskId, config).catch((err) => {
      db.prepare('UPDATE crawl_tasks SET status = ?, error_message = ? WHERE id = ?').run(
        'failed',
        err.message,
        taskId
      )
    })

    return { taskId }
  })

  // Pause crawl
  ipcMain.handle('crawl:pause', (_event, taskId: number) => {
    taskPaused.set(taskId, true)
    const db = getDatabase()
    db.prepare("UPDATE crawl_tasks SET status = 'paused', updated_at = datetime('now') WHERE id = ?").run(taskId)
    return { success: true }
  })

  // Resume crawl
  ipcMain.handle('crawl:resume', (_event, taskId: number) => {
    taskPaused.set(taskId, false)
    const db = getDatabase()
    db.prepare("UPDATE crawl_tasks SET status = 'running', updated_at = datetime('now') WHERE id = ?").run(taskId)
    return { success: true }
  })

  // Stop crawl
  ipcMain.handle('crawl:stop', (_event, taskId: number) => {
    taskPaused.set(taskId, false)
    taskAborted.set(taskId, true)
    const db = getDatabase()
    db.prepare("UPDATE crawl_tasks SET status = 'stopped', updated_at = datetime('now') WHERE id = ?").run(taskId)
    return { success: true }
  })

  // Delete task and all related data
  ipcMain.handle('task:delete', (_event, taskId: number) => {
    const db = getDatabase()
    
    // Get task info for output directory
    const task = db.prepare('SELECT seed_url FROM crawl_tasks WHERE id = ?').get(taskId) as { seed_url: string } | undefined
    
    // Delete from database (CASCADE will delete pages, links, ai_analysis)
    db.prepare('DELETE FROM crawl_tasks WHERE id = ?').run(taskId)
    
    // Delete output directory
    if (task) {
      try {
        const outputDir = join(app.getPath('userData'), 'output')
        const domain = new URL(task.seed_url).hostname.replace('www.', '')
        const taskOutputDir = join(outputDir, `task-${taskId}-${domain}`)
        if (existsSync(taskOutputDir)) {
          rmSync(taskOutputDir, { recursive: true, force: true })
        }
      } catch (err) {
    }
    }
    
    return { success: true }
  })

  // Clear all data and files
  ipcMain.handle('data:clearAll', () => {
    const db = getDatabase()
    
    // Clear all database tables
    db.prepare('DELETE FROM crawl_tasks').run()
    db.prepare('DELETE FROM pages').run()
    db.prepare('DELETE FROM links').run()
    db.prepare('DELETE FROM ai_analysis').run()
    
    // Clear all output directories
    try {
      const outputDir = join(app.getPath('userData'), 'output')
      if (existsSync(outputDir)) {
        rmSync(outputDir, { recursive: true, force: true })
      }
    } catch (err) {
    }
    
    return { success: true }
  })

  // Get config
  ipcMain.handle('config:get', () => {
    // TODO: load from config file
    return DEFAULT_CONFIG as AppConfig
  })

  // Set config
  ipcMain.handle('config:set', (_event, config: Record<string, unknown>) => {
    // TODO: save to config file
    return { success: true }
  })

  // Generate llms output for a task
  ipcMain.handle('output:generate', async (_event, taskId: number) => {
    const db = getDatabase()
    const task = db.prepare('SELECT * FROM crawl_tasks WHERE id = ?').get(taskId) as Record<string, unknown> | undefined
    if (!task) {
      return { success: false, error: 'Task not found' }
    }
    const seedUrl = task.seed_url as string
    return await generateOutput(taskId, seedUrl)
  })

  // Open output folder
  ipcMain.handle('output:openFolder', (_event, outputPath: string) => {
    shell.openPath(outputPath)
    return { success: true }
  })

  // Read llms.txt content
  ipcMain.handle('output:readTxt', (_event, filePath: string) => {
    try {
      if (!fs.existsSync(filePath)) {
        return { success: false, error: 'File not found' }
      }
      const content = fs.readFileSync(filePath, 'utf-8')
      return { success: true, content }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  })

  // Read llms.json content
  ipcMain.handle('output:readJson', (_event, filePath: string) => {
    try {
      if (!fs.existsSync(filePath)) {
        return { success: false, error: 'File not found' }
      }
      const content = fs.readFileSync(filePath, 'utf-8')
      return { success: true, content }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  })

  // Export file to user-selected location
  ipcMain.handle('output:exportFile', async (_event, { content, defaultName }: { content: string; defaultName: string }) => {
    try {
      const win = BrowserWindow.getFocusedWindow()
      const result = await dialog.showSaveDialog(win!, {
        defaultPath: defaultName,
        filters: [{ name: defaultName.split('.').pop() || 'File', extensions: [defaultName.split('.').pop() || 'txt'] }]
      })
      if (result.canceled || !result.filePath) {
        return { success: false }
      }
      fs.writeFileSync(result.filePath, content, 'utf-8')
      return { success: true, filePath: result.filePath }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) }
    }
  })
}

function sendProgress(taskId: number, data: Record<string, unknown>): void {
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    win.webContents.send('crawl:progress', { taskId, ...data })
  }
}

function sendLog(taskId: number, message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    win.webContents.send('crawl:log', { taskId, message, level, timestamp: Date.now() })
  }
}

// Export for use by pipeline
export { sendProgress, sendLog }
