const BASE_URL = '/api';

class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

// Get sessionId from localStorage (fallback when cookies are blocked)
function getSessionId() {
  return localStorage.getItem('sessionId');
}

// Add sessionId query param if needed (fallback for cookie-blocking browsers)
function addSessionParam(url) {
  const sessionId = getSessionId();
  if (sessionId) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}sessionId=${sessionId}`;
  }
  return url;
}

async function fetchApi(endpoint, options = {}) {
  let url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;
  
  // Add sessionId query param as fallback when cookies fail
  url = addSessionParam(url);
  
  const config = {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new ApiError(
        data.error || data.message || 'Request failed',
        response.status,
        data
      );
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError('Network error', 0, { originalError: error.message });
  }
}

export async function apiClient(endpoint, options = {}) {
  let url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;
  
  // Add sessionId query param as fallback when cookies fail
  url = addSessionParam(url);
  
  return fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options
  });
}

export const api = {
  get: (endpoint, options) => fetchApi(endpoint, { ...options, method: 'GET' }),
  post: (endpoint, data, options) => fetchApi(endpoint, { ...options, method: 'POST', body: JSON.stringify(data) }),
  put: (endpoint, data, options) => fetchApi(endpoint, { ...options, method: 'PUT', body: JSON.stringify(data) }),
  delete: (endpoint, options) => fetchApi(endpoint, { ...options, method: 'DELETE' }),
};

export { ApiError };
