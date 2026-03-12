import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/auth.guard';
import { dbContext } from '../common/request.util';
import { SearchService } from './search.service';

import type { Request } from 'express';

@Controller()
@UseGuards(AuthGuard)
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get('projects/:projectId/search')
  query(
    @Req() req: Request,
    @Param('projectId') projectId: string,
    @Query('q') q: string,
  ) {
    return this.search.search(dbContext(req), projectId, q ?? '');
  }
}
