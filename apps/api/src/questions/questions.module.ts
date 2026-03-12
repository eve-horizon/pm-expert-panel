import { Module } from '@nestjs/common';
import { DatabaseService } from '../common/database.service';
import { EveEventsService } from '../common/eve-events.service';
import { QuestionsController } from './questions.controller';
import { QuestionsService } from './questions.service';

@Module({
  controllers: [QuestionsController],
  providers: [QuestionsService, DatabaseService, EveEventsService],
  exports: [QuestionsService],
})
export class QuestionsModule {}
