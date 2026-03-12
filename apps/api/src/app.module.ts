import { Module } from '@nestjs/common';
import { ActivitiesModule } from './activities/activities.module';
import { AuditModule } from './audit/audit.module';
import { ChangesetsModule } from './changesets/changesets.module';
import { ChatModule } from './chat/chat.module';
import { ExportModule } from './export/export.module';
import { HealthModule } from './health/health.module';
import { MapModule } from './map/map.module';
import { PersonasModule } from './personas/personas.module';
import { ProjectsModule } from './projects/projects.module';
import { QuestionsModule } from './questions/questions.module';
import { ReleasesModule } from './releases/releases.module';
import { SearchModule } from './search/search.module';
import { SourcesModule } from './sources/sources.module';
import { StepsModule } from './steps/steps.module';
import { TasksModule } from './tasks/tasks.module';

@Module({
  imports: [
    HealthModule,
    ProjectsModule,
    PersonasModule,
    ActivitiesModule,
    StepsModule,
    QuestionsModule,
    ReleasesModule,
    TasksModule,
    MapModule,
    SourcesModule,
    ChangesetsModule,
    ChatModule,
    SearchModule,
    ExportModule,
    AuditModule,
  ],
})
export class AppModule {}
