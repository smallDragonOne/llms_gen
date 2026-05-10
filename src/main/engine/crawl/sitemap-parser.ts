export class SitemapParser {
  async parse(baseUrl: string): Promise<string[]> {
    try {
      const url = new URL(baseUrl)
      const sitemapUrl = `${url.origin}/sitemap.xml`

      const response = await fetch(sitemapUrl, {
        headers: { 'User-Agent': 'LLMS-Generator/1.0' },
        signal: AbortSignal.timeout(10000)
      })

      if (!response.ok) return []

      const text = await response.text()
      return this.parseSitemapXml(text, url.origin)
    } catch {
      return []
    }
  }

  private parseSitemapXml(xml: string, origin: string): string[] {
    const urls: string[] = []
    const urlRegex = /<loc>(.*?)<\/loc>/g
    let match: RegExpExecArray | null
    while ((match = urlRegex.exec(xml)) !== null) {
      const loc = match[1].trim()
      if (!/\.(pdf|zip|exe|jpg|jpeg|png|gif|svg|css|js)$/i.test(loc)) {
        urls.push(loc)
      }
    }
    return urls
  }
}
