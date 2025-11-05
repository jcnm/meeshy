/**
 * BFF Proxy Utility
 * Handles forwarding requests from Next.js API routes to the backend gateway
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * Get the internal backend URL for server-side requests
 * Uses INTERNAL_BACKEND_URL for SSR, falls back to NEXT_PUBLIC_BACKEND_URL
 */
export function getInternalBackendUrl(): string {
  // Use internal URL for server-side requests (SSR)
  const internalUrl = process.env.INTERNAL_BACKEND_URL;
  if (internalUrl) {
    return internalUrl;
  }

  // Fallback to public URL
  const publicUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (publicUrl) {
    return publicUrl;
  }

  // Default to localhost for development
  return 'http://localhost:3000';
}

/**
 * Forward a request to the backend gateway
 * @param request - The incoming Next.js request
 * @param endpoint - The backend endpoint (e.g., '/api/conversations')
 * @param options - Additional fetch options
 * @returns The response from the backend
 */
export async function proxyToGateway(
  request: NextRequest,
  endpoint: string,
  options?: {
    method?: string;
    body?: any;
    headers?: Record<string, string>;
  }
): Promise<NextResponse> {
  try {
    const backendUrl = getInternalBackendUrl();
    const url = `${backendUrl}${endpoint}`;

    // Extract headers from the incoming request
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options?.headers,
    };

    // Forward authentication headers
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const sessionToken = request.headers.get('x-session-token');
    if (sessionToken) {
      headers['X-Session-Token'] = sessionToken;
    }

    // Forward user-agent and other relevant headers
    const userAgent = request.headers.get('user-agent');
    if (userAgent) {
      headers['User-Agent'] = userAgent;
    }

    const acceptLanguage = request.headers.get('accept-language');
    if (acceptLanguage) {
      headers['Accept-Language'] = acceptLanguage;
    }

    // Prepare fetch options
    const fetchOptions: RequestInit = {
      method: options?.method || request.method,
      headers,
    };

    // Add body for POST, PUT, PATCH requests
    if (options?.body) {
      fetchOptions.body = JSON.stringify(options.body);
    } else if (
      request.method === 'POST' ||
      request.method === 'PUT' ||
      request.method === 'PATCH'
    ) {
      const body = await request.text();
      if (body) {
        fetchOptions.body = body;
      }
    }

    // Make the request to the backend
    const response = await fetch(url, fetchOptions);

    // Get response body
    const contentType = response.headers.get('content-type');
    let data: any;

    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    // Return the response with the same status code
    return NextResponse.json(data, {
      status: response.status,
      headers: {
        'Content-Type': contentType || 'application/json',
      },
    });
  } catch (error) {
    console.error('BFF Proxy Error:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Forward a file upload request to the backend gateway
 * @param request - The incoming Next.js request with FormData
 * @param endpoint - The backend endpoint
 * @returns The response from the backend
 */
export async function proxyFileUploadToGateway(
  request: NextRequest,
  endpoint: string
): Promise<NextResponse> {
  try {
    const backendUrl = getInternalBackendUrl();
    const url = `${backendUrl}${endpoint}`;

    // Extract headers from the incoming request
    const headers: Record<string, string> = {};

    // Forward authentication headers
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const sessionToken = request.headers.get('x-session-token');
    if (sessionToken) {
      headers['X-Session-Token'] = sessionToken;
    }

    // Get the FormData from the request
    const formData = await request.formData();

    // Make the request to the backend
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });

    // Get response body
    const contentType = response.headers.get('content-type');
    let data: any;

    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    // Return the response with the same status code
    return NextResponse.json(data, {
      status: response.status,
    });
  } catch (error) {
    console.error('BFF File Upload Proxy Error:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Extract query parameters from a Next.js request and append them to an endpoint
 * @param request - The incoming Next.js request
 * @param endpoint - The base endpoint
 * @returns The endpoint with query parameters
 */
export function appendQueryParams(request: NextRequest, endpoint: string): string {
  const { searchParams } = new URL(request.url);
  const params = new URLSearchParams(searchParams);
  const queryString = params.toString();

  if (queryString) {
    return `${endpoint}?${queryString}`;
  }

  return endpoint;
}
