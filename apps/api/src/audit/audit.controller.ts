import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/auth.guard';
import { dbContext } from '../common/request.util';
import { AuditService } from './audit.service';

import type { Request } from 'express';

@Controller()
@UseGuards(AuthGuard)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get('projects/:projectId/audit')
  async list(
    @Req() req: Request,
    @Param('projectId') projectId: string,
    @Query('entity_type') entityType?: string,
    @Query('actor') actor?: string,
    @Query('action') action?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const entries = await this.audit.list(dbContext(req), projectId, {
      entity_type: entityType,
      actor,
      action,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
    return { entries };
  }
}
