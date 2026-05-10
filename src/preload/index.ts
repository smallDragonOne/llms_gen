import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { CrawlConfig } from '../shared/types'

const api = {
  // Crawl
  crawlStart: (config: CrawlConfig) => ipcRenderer.invoke('crawl:start', config),
  crawlPause: (taskId: number) => ipcRenderer.invoke('crawl:pause', taskId),
  crawlResume: (taskId: number) => ipcRenderer.invoke('crawl:resume', taskId),
  crawlStop: (taskId: number) => ipcRenderer.invoke('crawl:stop', taskId),
  crawlRestart: (taskId: number) => ipcRenderer.invoke('crawl:restart', taskId),
  onCrawlProgress: (callback: (data: any) => void) => ipcRenderer.on('crawl:progress', (_event, data) => callback(data)),
  onCrawlLog: (callback: (data: any) => void) => ipcRenderer.on('crawl:log', (_event, data) => callback(data)),
  onCrawlComplete: (callback: (data: any) => void) => ipcRenderer.on('crawl:complete', (_event, data) => callback(data)),

  // DB
  getTasks: () => ipcRenderer.invoke('db:getTasks'),
  getPages: (taskId: number) => ipcRenderer.invoke('db:getPages', taskId),
  getTask: (taskId: number) => ipcRenderer.invoke('db:getTask', taskId),
  deleteTask: (taskId: number) => ipcRenderer.invoke('task:delete', taskId),
  clearAllData: () => ipcRenderer.invoke('data:clearAll'),

  // Config
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (config: Record<string, unknown>) => ipcRenderer.invoke('config:set', config),

  // Output
  generateOutput: (taskId: number) => ipcRenderer.invoke('output:generate', taskId),
  openOutputFolder: (outputPath: string) => ipcRenderer.invoke('output:openFolder', outputPath),
  readLlmsTxt: (filePath: string) => ipcRenderer.invoke('output:readTxt', filePath),
  readLlmsJson: (filePath: string) => ipcRenderer.invoke('output:readJson', filePath),
  exportFile: (params: { content: string; defaultName: string }) => ipcRenderer.invoke('output:exportFile', params),

  // Remove listeners
  removeAllListeners: (channel: string) => ipcRenderer.removeAllListeners(channel)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}
