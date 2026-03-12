import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../common/auth.guard';
import { dbContext } from '../common/request.util';
import { ChatGatewayService } from './chat-gateway.service';

import type { Request, Response } from 'express';

@Controller()
@UseGuards(AuthGuard)
export class ChatController {
  constructor(private readonly chat: ChatGatewayService) {}

  @Get('projects/:projectId/chat/threads')
  listThreads(@Param('projectId') projectId: string) {
    return this.chat.listThreads(projectId);
  }

  @Post('projects/:projectId/chat/threads')
  @HttpCode(HttpStatus.CREATED)
  createThread(
    @Req() req: Request,
    @Param('projectId') projectId: string,
    @Body() body: { message: string },
  ) {
    const ctx = dbContext(req);
    return this.chat.createThread(projectId, body.message, ctx.user_id ?? 'anonymous');
  }

  @Get('chat/threads/:threadId/messages')
  listMessages(@Param('threadId') threadId: string) {
    return this.chat.listMessages(threadId);
  }

  @Post('chat/threads/:threadId/messages')
  @HttpCode(HttpStatus.CREATED)
  sendMessage(
    @Req() req: Request,
    @Param('threadId') threadId: string,
    @Body() body: { message: string },
  ) {
    const ctx = dbContext(req);
    return this.chat.sendMessage(threadId, body.message, ctx.user_id ?? 'anonymous');
  }

  @Get('chat/threads/:threadId/stream')
  async stream(
    @Param('threadId') threadId: string,
    @Res() res: Response,
  ) {
    const upstream = await this.chat.getStreamResponse(threadId);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    if (!upstream.body) {
      res.end();
      return;
    }

    const reader = (upstream.body as any).getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(decoder.decode(value, { stream: true }));
      }
    } catch {
      // Client disconnected or upstream closed
    } finally {
      res.end();
    }
  }
}
