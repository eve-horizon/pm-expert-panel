import { Module } from '@nestjs/common';
import { DatabaseService } from '../common/database.service';
import { ChangesetsController } from './changesets.controller';
import { ChangesetsService } from './changesets.service';

@Module({
  controllers: [ChangesetsController],
  providers: [DatabaseService, ChangesetsService],
  exports: [ChangesetsService],
})
export class ChangesetsModule {}
