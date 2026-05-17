/**
 * API Utility for standardized fetch calls
 */

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const method = options?.method || 'GET';
  let finalUrl = url;
  
  if (method === 'GET') {
    const separator = url.includes('?') ? '&' : '?';
    finalUrl = `${url}${separator}_t=${Date.now()}`;
  }

  const response = await fetch(finalUrl, {
    ...options,
    headers: {
      'Accept': 'application/json',
      ...(options?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...options?.headers,
    },
  });

  const result: ApiResponse<T> = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'Unknown API Error');
  }

  return result.data as T;
}
