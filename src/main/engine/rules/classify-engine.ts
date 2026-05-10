import type { ClassifyResult } from '../../../shared/types'

interface ReferenceCategory {
  name: string
  priority: number
  patterns: string[]
}

export class ClassifyEngine {
  private referenceCategories: ReferenceCategory[] = []

  constructor() {
    this.loadDefaultCategories()
  }

  private loadDefaultCategories(): void {
    this.referenceCategories = [
      { name: '文档', priority: 1, patterns: ['/docs', '/documentation', '/guide', '/manual'] },
      { name: '博客', priority: 2, patterns: ['/blog', '/article', '/news', '/post'] },
      { name: '代码', priority: 3, patterns: ['/code', '/example', '/demo', '/snippet'] },
      { name: 'API参考', priority: 4, patterns: ['/api/reference', '/endpoint', '/swagger'] },
      { name: '教程', priority: 5, patterns: ['/tutorial', '/getting-started', '/learn', '/quickstart'] },
      { name: '关于', priority: 6, patterns: ['/about', '/team', '/contact'] }
    ]
  }

  classify(url: string): ClassifyResult {
    let bestMatch: ReferenceCategory | null = null
    let bestPriority = Infinity

    for (const cat of this.referenceCategories) {
      for (const pattern of cat.patterns) {
        const regex = new RegExp(pattern, 'i')
        if (regex.test(url) && cat.priority < bestPriority) {
          bestMatch = cat
          bestPriority = cat.priority
        }
      }
    }

    if (bestMatch) {
      return {
        category: bestMatch.name,
        confidence: 0.7,
        source: 'rule'
      }
    }

    return {
      category: 'unknown',
      confidence: 0,
      source: 'rule'
    }
  }

  getReferenceCategories(): string[] {
    return this.referenceCategories.map((c) => c.name)
  }
}
