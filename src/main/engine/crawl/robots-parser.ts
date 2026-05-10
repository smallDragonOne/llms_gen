export interface RobotsResult {
  allow: string[]
  disallow: string[]
  sitemap: string[]
  crawlDelay?: number
}

export class RobotsParser {
  async parse(baseUrl: string): Promise<RobotsResult> {
    try {
      const url = new URL(baseUrl)
      const response = await fetch(`${url.origin}/robots.txt`, {
        headers: { 'User-Agent': 'LLMS-Generator/1.0' },
        signal: AbortSignal.timeout(10000)
      })

      if (!response.ok) {
        return { allow: [], disallow: [], sitemap: [] }
      }

      const text = await response.text()
      return this.parseRobotsTxt(text)
    } catch {
      return { allow: [], disallow: [], sitemap: [] }
    }
  }

  private parseRobotsTxt(text: string): RobotsResult {
    const result: RobotsResult = { allow: [], disallow: [], sitemap: [] }
    const lines = text.split('\n')

    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith('#') || trimmed.length === 0) continue

      const match = trimmed.match(/^(\w+):\s*(.+)$/i)
      if (!match) continue

      const directive = match[1].toLowerCase()
      const value = match[2].trim()

      switch (directive) {
        case 'allow':
          result.allow.push(value)
          break
        case 'disallow':
          result.disallow.push(value)
          break
        case 'sitemap':
          result.sitemap.push(value)
          break
        case 'crawl-delay':
          result.crawlDelay = parseInt(value, 10) || undefined
          break
      }
    }

    return result
  }

  isAllowed(url: string, robots: RobotsResult): boolean {
    for (const pattern of robots.disallow) {
      if (pattern === '') continue
      const regex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\?/g, '\\?'))
      if (regex.test(url)) return false
    }
    return true
  }
}
