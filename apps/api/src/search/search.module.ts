import { Module } from '@nestjs/common';
import { DatabaseService } from '../common/database.service';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  controllers: [SearchController],
  providers: [SearchService, DatabaseService],
})
export class SearchModule {}
