import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../common/auth.guard';
import { dbContext } from '../common/request.util';
import { SourcesService } from './sources.service';

import type { Request } from 'express';

@Controller()
export class SourcesController {
  private readonly logger = new Logger(SourcesController.name);

  constructor(private readonly sources: SourcesService) {}

  // -------------------------------------------------------------------------
  // Authenticated endpoints
  // -------------------------------------------------------------------------

  @Get('projects/:projectId/sources')
  @UseGuards(AuthGuard)
  list(@Req() req: Request, @Param('projectId') projectId: string) {
    return this.sources.list(dbContext(req), projectId);
  }

  @Post('projects/:projectId/sources')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.CREATED)
  create(
    @Req() req: Request,
    @Param('projectId') projectId: string,
    @Body()
    body: { filename: string; content_type?: string; file_size?: number },
  ) {
    return this.sources.create(dbContext(req), projectId, body);
  }

  @Get('sources/:id')
  @UseGuards(AuthGuard)
  findById(@Req() req: Request, @Param('id') id: string) {
    return this.sources.findById(dbContext(req), id);
  }

  @Post('sources/:id/confirm')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  confirm(@Req() req: Request, @Param('id') id: string) {
    return this.sources.confirm(dbContext(req), id);
  }

  // -------------------------------------------------------------------------
  // Eve callback — no auth guard (Eve signs via service token in payload)
  // -------------------------------------------------------------------------

  @Post('webhooks/ingest-complete')
  @HttpCode(HttpStatus.OK)
  async ingestCallback(
    @Body()
    body: {
      ingest_id: string;
      status: 'done' | 'failed';
      job_id?: string;
      error_message?: string | null;
    },
  ) {
    this.logger.log(
      `Ingest callback: ${body.ingest_id} → ${body.status}`,
    );

    // Look up the source by Eve ingest ID. Use a system-level context
    // since the callback comes from the Eve orchestrator, not a user.
    const source = await this.sources.findByEveIngestId(body.ingest_id);

    if (!source) {
      this.logger.warn(`Ingest callback: no source found for eve_ingest_id=${body.ingest_id}`);
      return { received: true, matched: false };
    }

    const status = body.status === 'done' ? 'done' : 'failed';

    await this.sources.updateStatus(
      { org_id: source.org_id },
      source.id,
      status,
      {
        eve_job_id: body.job_id,
        error_message: body.error_message ?? undefined,
      },
    );

    return { received: true, matched: true, source_id: source.id };
  }
}
