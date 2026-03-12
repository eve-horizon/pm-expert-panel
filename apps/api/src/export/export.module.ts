import { Module } from '@nestjs/common';
import { DatabaseService } from '../common/database.service';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';

@Module({
  controllers: [ExportController],
  providers: [ExportService, DatabaseService],
})
export class ExportModule {}
