import type { AIReviewResponse, AnalysisResponse, PubMedArticle, SearchResponse } from '../types/api'

function detailMessage(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null || !('detail' in body)) return
  const detail = body.detail
  if (typeof detail === 'string') {
    const localized: Record<string, string> = {
      'PubMed service is temporarily unavailable. Please try again later.': 'PubMed 服务暂时不可用，请稍后重试。',
      'AI review is not configured.': 'AI 综述服务尚未完成配置。',
      'No abstracts are available for AI review.': '当前没有可用于 AI 综述的 Abstract。',
      'No abstracts fit within the AI review context limit.': '当前文献 Abstract 超出 AI 综述的上下文长度限制。',
      'AI review service is temporarily unavailable. Please try again.': 'AI 综述服务暂时不可用，请稍后重试。',
      'AI review returned an invalid response. Please try again.': 'AI 综述返回的内容无效，请重试。',
    }
    return localized[detail] ?? '请求未能完成，请稍后重试。'
  }
  if (Array.isArray(detail)) {
    const messages = detail.flatMap((item: unknown) => {
      if (typeof item === 'object' && item !== null && 'msg' in item && typeof item.msg === 'string') {
        return [item.msg]
      }
      return []
    })
    return messages.length ? '请求内容不符合要求，请检查输入后重试。' : undefined
  }
}

async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  if (signal?.aborted) controller.abort()
  const timeout = window.setTimeout(() => controller.abort(), 90_000)
  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const payload: unknown = await response.json().catch(() => null)
    if (!response.ok) {
      throw new Error(detailMessage(payload) ?? (
        response.status === 503
          ? path === '/api/ai-review'
            ? 'AI 综述服务暂时不可用，请稍后重试。'
            : 'PubMed 服务暂时不可用，请稍后重试。'
          : `请求未能完成（HTTP ${response.status}），请稍后重试。`
      ))
    }
    if (payload === null) throw new Error('服务器返回的响应为空或无法读取。')
    return payload as T
  } catch (error) {
    if (controller.signal.aborted) throw new Error('请求超时，请重试。')
    if (error instanceof TypeError) {
      throw new Error('无法连接到后端服务，请确认服务正在运行后重试。')
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
    signal?.removeEventListener('abort', abort)
  }
}

export function searchLiterature(query: string): Promise<SearchResponse> {
  return post('/api/search', { query: query.trim() })
}

export function analyzeLiterature(articles: PubMedArticle[], totalCount: number): Promise<AnalysisResponse> {
  return post('/api/analysis', { articles, total_count: totalCount })
}

export function generateAIReview(query: string, articles: PubMedArticle[], signal?: AbortSignal): Promise<AIReviewResponse> {
  return post('/api/ai-review', { query, articles }, signal)
}
