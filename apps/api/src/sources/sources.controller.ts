import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
@UseGuards(AuthGuard)
export class SourcesController {
  constructor(private readonly sources: SourcesService) {}

  @Get('projects/:projectId/sources')
  list(@Req() req: Request, @Param('projectId') projectId: string) {
    return this.sources.list(dbContext(req), projectId);
  }

  @Post('projects/:projectId/sources')
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
  findById(@Req() req: Request, @Param('id') id: string) {
    return this.sources.findById(dbContext(req), id);
  }

  @Post('sources/:id/confirm')
  @HttpCode(HttpStatus.OK)
  confirm(@Req() req: Request, @Param('id') id: string) {
    return this.sources.confirm(dbContext(req), id);
  }
}
