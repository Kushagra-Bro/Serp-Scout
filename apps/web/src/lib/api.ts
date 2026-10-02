import { ApiResponse } from '@serp-scout/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface FetchOptions extends RequestInit {
  token?: string | null;
  workspaceId?: string | null;
}

export async function apiClient<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { token, workspaceId, headers: customHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(customHeaders as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (workspaceId) {
    headers['x-workspace-id'] = workspaceId;
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

  const res = await fetch(url, {
    ...rest,
    headers,
  });

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const rawText = await res.text();
    if (!res.ok) {
      throw new Error(`Server returned error (${res.status} ${res.statusText}): ${rawText.slice(0, 160)}`);
    }
    throw new Error(`Expected JSON response from ${endpoint} but received ${contentType || 'non-JSON'}`);
  }

  let data: ApiResponse<T>;
  try {
    data = (await res.json()) as ApiResponse<T>;
  } catch (jsonErr: any) {
    throw new Error(`Failed to parse response from ${endpoint}: ${jsonErr.message}`);
  }

  if (!res.ok || !data.success) {
    const message = data.error?.message || `Request failed with status ${res.status}`;
    // Carry status/code so callers can branch (e.g. duplicate website -> 409).
    const err = new Error(message) as Error & { status?: number; code?: string };
    err.status = res.status;
    err.code = data.error?.code;
    throw err;
  }

  return data.data as T;
}
