import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

// ---------------------------------------------------------------------------
// ChatGatewayService — proxies chat requests to Eve Gateway API
//
// When EVE_API_URL is configured (staging/production), proxies to Eve's
// job/message system. Returns 503 when Eve is unavailable (local dev).
// ---------------------------------------------------------------------------

@Injectable()
export class ChatGatewayService {
  private readonly logger = new Logger(ChatGatewayService.name);
  private readonly eveApiUrl = process.env.EVE_API_URL;
  private readonly eveProjectId = process.env.EVE_PROJECT_ID;
  private readonly eveServiceToken = process.env.EVE_SERVICE_TOKEN;

  private get available(): boolean {
    return Boolean(this.eveApiUrl && this.eveProjectId);
  }

  private assertAvailable(): void {
    if (!this.available) {
      throw new ServiceUnavailableException(
        'Chat requires Eve platform (EVE_API_URL not configured)',
      );
    }
  }

  private get headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      ...(this.eveServiceToken
        ? { Authorization: `Bearer ${this.eveServiceToken}` }
        : {}),
    };
  }

  private async proxy<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    this.assertAvailable();

    const url = `${this.eveApiUrl}${path}`;
    this.logger.debug(`${method} ${url}`);

    const response = await fetch(url, {
      method,
      headers: this.headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      this.logger.warn(`Eve proxy error: ${method} ${path} → ${response.status} ${text}`);
      throw new ServiceUnavailableException(
        `Eve Gateway returned ${response.status}`,
      );
    }

    return response.json() as Promise<T>;
  }

  // -------------------------------------------------------------------------
  // Threads
  // -------------------------------------------------------------------------

  async listThreads(projectId: string): Promise<unknown[]> {
    return this.proxy<unknown[]>(
      'GET',
      `/projects/${this.eveProjectId}/chat/threads?eden_project_id=${projectId}`,
    );
  }

  async createThread(
    projectId: string,
    message: string,
    userId: string,
  ): Promise<unknown> {
    return this.proxy<unknown>('POST', `/projects/${this.eveProjectId}/chat/threads`, {
      eden_project_id: projectId,
      message,
      user_id: userId,
    });
  }

  // -------------------------------------------------------------------------
  // Messages
  // -------------------------------------------------------------------------

  async listMessages(threadId: string): Promise<unknown[]> {
    return this.proxy<unknown[]>(
      'GET',
      `/projects/${this.eveProjectId}/chat/threads/${threadId}/messages`,
    );
  }

  async sendMessage(
    threadId: string,
    message: string,
    userId: string,
  ): Promise<unknown> {
    return this.proxy<unknown>(
      'POST',
      `/projects/${this.eveProjectId}/chat/threads/${threadId}/messages`,
      { message, user_id: userId },
    );
  }

  // -------------------------------------------------------------------------
  // SSE stream — returns the raw Response for piping
  // -------------------------------------------------------------------------

  async getStreamResponse(threadId: string): Promise<Response> {
    this.assertAvailable();

    const url = `${this.eveApiUrl}/projects/${this.eveProjectId}/chat/threads/${threadId}/stream`;

    const response = await fetch(url, {
      headers: {
        ...this.headers,
        Accept: 'text/event-stream',
      },
    });

    if (!response.ok) {
      throw new ServiceUnavailableException(
        `Eve SSE stream returned ${response.status}`,
      );
    }

    return response;
  }
}
