const apiBaseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')

export const socketUrl = apiBaseUrl || undefined

export function apiUrl(path) {
  return `${apiBaseUrl}${path}`
}

export function ownerHeaders(token, headers = {}) {
  let email = ''
  try {
    email = localStorage.getItem('karavali_owner_email') || 'rakesh@gmail.com'
  } catch {}
  return {
    ...headers,
    Authorization: `Bearer ${token || 'owner-session'}`,
    'X-Owner-Email': email,
  }
}
