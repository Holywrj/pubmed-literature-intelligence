import type { AIReviewResponse, AnalysisResponse, PubMedArticle, SearchResponse } from '../types/api'

function detailMessage(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null || !('detail' in body)) return
  const detail = body.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    const messages = detail.flatMap((item: unknown) => {
      if (typeof item === 'object' && item !== null && 'msg' in item && typeof item.msg === 'string') {
        return [item.msg]
      }
      return []
    })
    return messages.join(' · ') || undefined
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
            ? 'AI review service is temporarily unavailable. Please try again.'
            : 'PubMed is temporarily unavailable. Please try again later.'
          : `The request could not be completed (HTTP ${response.status}). Please try again.`
      ))
    }
    if (payload === null) throw new Error('The server returned an empty or unreadable response.')
    return payload as T
  } catch (error) {
    if (controller.signal.aborted) throw new Error('The request timed out. Please try again.')
    if (error instanceof TypeError) {
      throw new Error('Cannot connect to the backend. Check that the backend is running and try again.')
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
