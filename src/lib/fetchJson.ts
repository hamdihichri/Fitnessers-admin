export class FetchJsonError extends Error {
  status: number
  url: string
  bodyPreview: string

  constructor(args: { message: string; status: number; url: string; bodyPreview: string }) {
    super(args.message)
    this.name = 'FetchJsonError'
    this.status = args.status
    this.url = args.url
    this.bodyPreview = args.bodyPreview
  }
}

export async function fetchJson<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(input, init)

  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : ''
  const contentType = (res.headers.get('content-type') ?? '').toLowerCase()

  // If the server returned HTML (e.g. Next error page / login page), never call res.json().
  if (!contentType.includes('application/json')) {
    const text = await res.text().catch(() => '')
    const preview = text.slice(0, 180)

    throw new FetchJsonError({
      message: `Expected JSON but got ${contentType || 'unknown content-type'} (${res.status}) for ${url}`,
      status: res.status,
      url,
      bodyPreview: preview,
    })
  }

  const data = (await res.json().catch(async () => {
    const text = await res.text().catch(() => '')
    const preview = text.slice(0, 180)
    throw new FetchJsonError({
      message: `Failed to parse JSON (${res.status}) for ${url}`,
      status: res.status,
      url,
      bodyPreview: preview,
    })
  })) as T

  if (!res.ok) {
    throw new FetchJsonError({
      message: `Request failed (${res.status}) for ${url}`,
      status: res.status,
      url,
      bodyPreview: JSON.stringify(data).slice(0, 180),
    })
  }

  return data
}
