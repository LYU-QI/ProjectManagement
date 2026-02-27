import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { RequirementsModule } from './modules/requirements/requirements.module';
import { CostsModule } from './modules/costs/costs.module';
import { SchedulesModule } from './modules/schedules/schedules.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AiModule } from './modules/ai/ai.module';
import { DatabaseModule } from './database/database.module';
import { WorklogsModule } from './modules/worklogs/worklogs.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { AuditInterceptor } from './audit/audit.interceptor';
import { FeishuModule } from './modules/feishu/feishu.module';
import { UsersModule } from './modules/users/users.module';
import { RisksModule } from './modules/risks/risks.module';
import { ConfigModule } from './modules/config/config.module';
import { FeishuUsersModule } from './modules/feishu-users/feishu-users.module';
import { PmAssistantModule } from './modules/pm-assistant/pm-assistant.module';
import { PrdModule } from './modules/prd/prd.module';
import { ProjectMembershipsModule } from './modules/project-memberships/project-memberships.module';

@Module({
  imports: [
    DatabaseModule,
    ScheduleModule.forRoot(),
    NotificationsModule,
    AuthModule,
    ProjectsModule,
    RequirementsModule,
    CostsModule,
    SchedulesModule,
    WorklogsModule,
    DashboardModule,
    AiModule,
    AuditLogsModule,
    UsersModule,
    FeishuModule,
    RisksModule,
    ConfigModule,
    FeishuUsersModule,
    PmAssistantModule,
    PrdModule,
    ProjectMembershipsModule
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor
    }
  ]
})
export class AppModule { }
