const apiBaseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')

export const socketUrl = apiBaseUrl || undefined

export function apiUrl(path) {
  return `${apiBaseUrl}${path}`
}

export function ownerHeaders(token, headers = {}) {
  return {
    ...headers,
    Authorization: 'Bearer '.concat(token),
  }
}
