import type { FilterResult, ExtractedContent } from '../../../shared/types'

interface FilterRule {
  pattern: string
  type: 'regex' | 'glob'
}

export class FilterEngine {
  private excludeRules: FilterRule[] = []
  private includeRules: FilterRule[] = []
  private minContentLength: number

  constructor(options?: { minContentLength?: number }) {
    this.minContentLength = options?.minContentLength || 100
    this.loadDefaultRules()
  }

  private loadDefaultRules(): void {
    this.excludeRules = [
      { pattern: '/(login|signin|signup|register|logout|auth)', type: 'regex' },
      { pattern: '/(search|query|find)', type: 'regex' },
      { pattern: '[?&](q|query|search|keyword)=', type: 'regex' },
      { pattern: '[?&]page=\\d+', type: 'regex' },
      { pattern: '[?&](utm_|ref=|source=|fbclid=|gclid=)', type: 'regex' },
      { pattern: '\\.(jpg|jpeg|png|gif|svg|pdf|zip|exe|dmp)$', type: 'regex' },
      { pattern: '/(admin|dashboard|settings|wp-admin)/?', type: 'regex' }
    ]

    this.includeRules = [
      { pattern: '/(docs|documentation|guide|tutorial)', type: 'regex' },
      { pattern: '/(api|reference|endpoint|swagger)', type: 'regex' },
      { pattern: '/(help|support|faq|knowledge-base)', type: 'regex' },
      { pattern: '/(getting-started|quickstart|intro)', type: 'regex' }
    ]
  }

  shouldFilterUrl(url: string): FilterResult {
    for (const rule of this.excludeRules) {
      if (this.matchRule(url, rule)) {
        return { filtered: true, reason: `URL matches exclude pattern: ${rule.pattern}` }
      }
    }
    return { filtered: false }
  }

  shouldFilterContent(content: ExtractedContent): FilterResult {
    if (content.contentLength < this.minContentLength) {
      return { filtered: true, reason: `Content too short: ${content.contentLength} chars (min: ${this.minContentLength})` }
    }
    return { filtered: false }
  }

  private matchRule(url: string, rule: FilterRule): boolean {
    if (rule.type === 'regex') {
      return new RegExp(rule.pattern, 'i').test(url)
    }
    // Simple glob: convert * to .*
    const regex = new RegExp(rule.pattern.replace(/\*/g, '.*'), 'i')
    return regex.test(url)
  }
}
