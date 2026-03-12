import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../common/auth.guard';
import { dbContext } from '../common/request.util';
import {
  ChangesetsService,
  CreateChangesetInput,
  ReviewDecision,
} from './changesets.service';

import type { Request } from 'express';

@Controller()
@UseGuards(AuthGuard)
export class ChangesetsController {
  constructor(private readonly changesets: ChangesetsService) {}

  @Get('projects/:projectId/changesets')
  list(
    @Req() req: Request,
    @Param('projectId') projectId: string,
    @Query('status') status?: string,
  ) {
    return this.changesets.list(dbContext(req), projectId, { status });
  }

  @Post('projects/:projectId/changesets')
  @HttpCode(HttpStatus.CREATED)
  create(
    @Req() req: Request,
    @Param('projectId') projectId: string,
    @Body() body: CreateChangesetInput,
  ) {
    return this.changesets.create(dbContext(req), projectId, body);
  }

  @Get('changesets/:id')
  findById(@Req() req: Request, @Param('id') id: string) {
    return this.changesets.findById(dbContext(req), id);
  }

  @Post('changesets/:id/accept')
  @HttpCode(HttpStatus.OK)
  accept(@Req() req: Request, @Param('id') id: string) {
    return this.changesets.accept(dbContext(req), id);
  }

  @Post('changesets/:id/reject')
  @HttpCode(HttpStatus.OK)
  reject(@Req() req: Request, @Param('id') id: string) {
    return this.changesets.reject(dbContext(req), id);
  }

  @Post('changesets/:id/review')
  @HttpCode(HttpStatus.OK)
  review(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: { decisions: ReviewDecision[] },
  ) {
    return this.changesets.review(dbContext(req), id, body.decisions);
  }
}
