import type { Page, Request, Response } from 'playwright';

export interface NetworkRequest {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  postData?: string;
  resourceType: string;
  timestamp: number;
  isNavigationRequest: boolean;
}

export interface NetworkResponse {
  requestId: string;
  url: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  timing?: {
    startTime: number;
    domainLookupStart: number;
    domainLookupEnd: number;
    connectStart: number;
    secureConnectionStart: number;
    connectEnd: number;
    requestStart: number;
    responseStart: number;
    responseEnd: number;
  };
  body?: string;
  timestamp: number;
}

export interface NetworkFailure {
  requestId: string;
  url: string;
  method: string;
  errorText: string;
  timestamp: number;
}

export interface ApiCall {
  request: NetworkRequest;
  response?: NetworkResponse;
  failure?: NetworkFailure;
  duration?: number;
}

export class NetworkMonitor {
  private requests: Map<string, NetworkRequest> = new Map();
  private responses: Map<string, NetworkResponse> = new Map();
  private failures: NetworkFailure[] = [];
  private apiCalls: Map<string, ApiCall> = new Map();
  private attached: boolean = false;
  private requestCounter: number = 0;
  private captureResponseBody: boolean = false;
  private apiPatterns: RegExp[] = [/\/api\//, /cloudfunctions\.net/];

  /**
   * Attach network monitor to a Playwright page
   */
  attach(page: Page, options: { captureResponseBody?: boolean; apiPatterns?: RegExp[] } = {}): void {
    if (this.attached) {
      console.warn('NetworkMonitor already attached to a page');
      return;
    }

    this.captureResponseBody = options.captureResponseBody ?? false;
    if (options.apiPatterns) {
      this.apiPatterns = options.apiPatterns;
    }

    // Capture requests
    page.on('request', (request: Request) => {
      const id = `req_${++this.requestCounter}`;
      
      const networkRequest: NetworkRequest = {
        id,
        url: request.url(),
        method: request.method(),
        headers: request.headers(),
        postData: request.postData() || undefined,
        resourceType: request.resourceType(),
        timestamp: Date.now(),
        isNavigationRequest: request.isNavigationRequest(),
      };

      this.requests.set(id, networkRequest);

      // Track API calls separately
      if (this.isApiCall(request.url())) {
        this.apiCalls.set(id, { request: networkRequest });
      }
    });

    // Capture responses
    page.on('response', async (response: Response) => {
      const request = response.request();
      const requestEntry = this.findRequestByUrl(request.url(), request.method());
      
      if (!requestEntry) return;

      const [id, networkRequest] = requestEntry;
      
      let body: string | undefined;
      if (this.captureResponseBody && this.isApiCall(response.url())) {
        try {
          body = await response.text();
        } catch {
          // Response body might not be available
        }
      }

      const networkResponse: NetworkResponse = {
        requestId: id,
        url: response.url(),
        status: response.status(),
        statusText: response.statusText(),
        headers: response.headers(),
        timing: response.request().timing(),
        body,
        timestamp: Date.now(),
      };

      this.responses.set(id, networkResponse);

      // Update API call
      const apiCall = this.apiCalls.get(id);
      if (apiCall) {
        apiCall.response = networkResponse;
        apiCall.duration = networkResponse.timestamp - networkRequest.timestamp;
      }
    });

    // Capture request failures
    page.on('requestfailed', (request: Request) => {
      const requestEntry = this.findRequestByUrl(request.url(), request.method());
      
      if (!requestEntry) return;

      const [id] = requestEntry;
      
      const failure: NetworkFailure = {
        requestId: id,
        url: request.url(),
        method: request.method(),
        errorText: request.failure()?.errorText || 'Unknown error',
        timestamp: Date.now(),
      };

      this.failures.push(failure);

      // Update API call
      const apiCall = this.apiCalls.get(id);
      if (apiCall) {
        apiCall.failure = failure;
      }
    });

    this.attached = true;
  }

  /**
   * Check if URL matches API patterns
   */
  private isApiCall(url: string): boolean {
    return this.apiPatterns.some(pattern => pattern.test(url));
  }

  /**
   * Find request by URL and method
   */
  private findRequestByUrl(url: string, method: string): [string, NetworkRequest] | null {
    for (const [id, request] of this.requests) {
      if (request.url === url && request.method === method) {
        return [id, request];
      }
    }
    return null;
  }

  /**
   * Get all captured requests
   */
  getRequests(): NetworkRequest[] {
    return Array.from(this.requests.values());
  }

  /**
   * Get all captured responses
   */
  getResponses(): NetworkResponse[] {
    return Array.from(this.responses.values());
  }

  /**
   * Get all failures
   */
  getFailures(): NetworkFailure[] {
    return [...this.failures];
  }

  /**
   * Get all API calls
   */
  getApiCalls(): ApiCall[] {
    return Array.from(this.apiCalls.values());
  }

  /**
   * Get failed API calls
   */
  getFailedApiCalls(): ApiCall[] {
    return this.getApiCalls().filter(call => 
      call.failure || (call.response && call.response.status >= 400)
    );
  }

  /**
   * Get API calls by URL pattern
   */
  getApiCallsByPattern(pattern: RegExp): ApiCall[] {
    return this.getApiCalls().filter(call => pattern.test(call.request.url));
  }

  /**
   * Get API calls by endpoint
   */
  getApiCallsByEndpoint(endpoint: string): ApiCall[] {
    return this.getApiCalls().filter(call => call.request.url.includes(endpoint));
  }

  /**
   * Check if there are any failed requests
   */
  hasFailures(): boolean {
    return this.failures.length > 0 || this.getFailedApiCalls().length > 0;
  }

  /**
   * Wait for a specific API call to complete
   */
  async waitForApiCall(
    pattern: RegExp | string,
    timeout: number = 10000
  ): Promise<ApiCall | null> {
    const startTime = Date.now();
    const checkPattern = typeof pattern === 'string' 
      ? (url: string) => url.includes(pattern)
      : (url: string) => pattern.test(url);

    while (Date.now() - startTime < timeout) {
      const calls = this.getApiCalls();
      const matchingCall = calls.find(
        call => checkPattern(call.request.url) && call.response
      );
      
      if (matchingCall) {
        return matchingCall;
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return null;
  }

  /**
   * Get summary of network activity
   */
  getSummary(): {
    totalRequests: number;
    totalResponses: number;
    failures: number;
    apiCalls: number;
    failedApiCalls: number;
    byResourceType: Record<string, number>;
    byStatus: Record<number, number>;
  } {
    const byResourceType: Record<string, number> = {};
    const byStatus: Record<number, number> = {};

    for (const request of this.requests.values()) {
      byResourceType[request.resourceType] = 
        (byResourceType[request.resourceType] || 0) + 1;
    }

    for (const response of this.responses.values()) {
      byStatus[response.status] = (byStatus[response.status] || 0) + 1;
    }

    return {
      totalRequests: this.requests.size,
      totalResponses: this.responses.size,
      failures: this.failures.length,
      apiCalls: this.apiCalls.size,
      failedApiCalls: this.getFailedApiCalls().length,
      byResourceType,
      byStatus,
    };
  }

  /**
   * Clear all captured data
   */
  clear(): void {
    this.requests.clear();
    this.responses.clear();
    this.failures = [];
    this.apiCalls.clear();
    this.requestCounter = 0;
  }

  /**
   * Export data as JSON
   */
  toJSON(): {
    requests: NetworkRequest[];
    responses: NetworkResponse[];
    failures: NetworkFailure[];
    apiCalls: ApiCall[];
    summary: ReturnType<NetworkMonitor['getSummary']>;
  } {
    return {
      requests: this.getRequests(),
      responses: this.getResponses(),
      failures: this.getFailures(),
      apiCalls: this.getApiCalls(),
      summary: this.getSummary(),
    };
  }
}

export default NetworkMonitor;
