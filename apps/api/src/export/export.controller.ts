import { Controller, Get, Header, Param, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/auth.guard';
import { dbContext } from '../common/request.util';
import { ExportService } from './export.service';

import type { Request } from 'express';

@Controller()
@UseGuards(AuthGuard)
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get('projects/:projectId/export/json')
  exportJson(
    @Req() req: Request,
    @Param('projectId') projectId: string,
  ) {
    return this.exportService.exportJson(dbContext(req), projectId);
  }

  @Get('projects/:projectId/export/markdown')
  async exportMarkdown(
    @Req() req: Request,
    @Param('projectId') projectId: string,
  ) {
    const markdown = await this.exportService.exportMarkdown(dbContext(req), projectId);
    return { markdown };
  }
}
