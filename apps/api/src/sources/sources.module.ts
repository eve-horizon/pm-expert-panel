import { Module } from '@nestjs/common';
import { DatabaseService } from '../common/database.service';
import { EveIngestService } from './eve-ingest.service';
import { SourcesController } from './sources.controller';
import { SourcesService } from './sources.service';

@Module({
  controllers: [SourcesController],
  providers: [DatabaseService, EveIngestService, SourcesService],
  exports: [SourcesService],
})
export class SourcesModule {}
