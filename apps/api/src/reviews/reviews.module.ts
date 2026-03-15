import { Module } from '@nestjs/common';
import { DatabaseService } from '../common/database.service';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  controllers: [ReviewsController],
  providers: [DatabaseService, ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
