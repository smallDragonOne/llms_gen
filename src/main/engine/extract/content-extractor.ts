import { Readability } from '@mozilla/readability'
import { JSDOM } from 'jsdom'
import * as crypto from 'crypto'
import type { ExtractedContent, Heading, Link } from '../../../shared/types'

export class ContentExtractor {
  extract(html: string, url: string): ExtractedContent {
    const dom = new JSDOM(html, { url })
    const reader = new Readability(dom.window.document)
    const article = reader.parse()

    // Extract headings
    const headings: Heading[] = []
    dom.window.document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((el) => {
      const tag = el.tagName.toLowerCase()
      const level = parseInt(tag.replace('h', ''), 10)
      headings.push({ level, text: el.textContent?.trim() || '' })
    })

    // Extract code blocks
    const codeBlocks: string[] = []
    dom.window.document.querySelectorAll('pre code').forEach((el) => {
      codeBlocks.push(el.textContent || '')
    })

    // Extract links
    const links: Link[] = []
    dom.window.document.querySelectorAll('a[href]').forEach((el) => {
      const href = el.getAttribute('href') || ''
      const text = el.textContent?.trim() || ''
      if (href && text) {
        links.push({ href, text })
      }
    })

    // Get SEO metadata
    const title = article?.title || dom.window.document.querySelector('title')?.textContent?.trim() || ''
    const description =
      article?.excerpt ||
      dom.window.document.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() ||
      ''
    const h1 = dom.window.document.querySelector('h1')?.textContent?.trim() || ''
    const lang = dom.window.document.documentElement.getAttribute('lang') || ''
    const siteName = article?.siteName || ''

    const textContent = article?.textContent || ''
    const content = article?.content || ''
    const contentHash = textContent ? crypto.createHash('sha256').update(textContent).digest('hex') : ''

    return {
      url,
      title,
      description,
      h1,
      headings,
      content,
      textContent,
      codeBlocks,
      links,
      contentHash,
      lang,
      siteName,
      hasCodeBlock: codeBlocks.length > 0,
      headingCount: headings.length,
      contentLength: textContent.length
    }
  }
}
