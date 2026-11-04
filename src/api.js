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

export function conductorHeaders(token, headers = {}) {
  let savedToken = token
  if (!savedToken) {
    try {
      savedToken = localStorage.getItem('karavali_conductor_token') || ''
    } catch {}
  }
  return {
    ...headers,
    Authorization: `Bearer ${savedToken || ''}`,
  }
}
