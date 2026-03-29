import { APP_GUARD } from '@nestjs/core';
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
import { WorkItemsModule } from './modules/work-items/work-items.module';
import { MilestoneBoardModule } from './modules/milestone-board/milestone-board.module';
import { SprintModule } from './modules/sprint/sprint.module';
import { JwtAuthGuard } from './modules/auth/jwt-auth.guard';
import { RolesGuard } from './modules/auth/roles.guard';
import { OrgGuard } from './guards/org.guard';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { TesthubModule } from './modules/testhub/testhub.module';
import { WikiModule } from './modules/wiki/wiki.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { ApiKeysModule } from './modules/api-keys/api-keys.module';
import { SmartFillModule } from './modules/smart-fill/smart-fill.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { AutomationModule } from './modules/automation/automation.module';
import { CostReportModule } from './modules/cost-report/cost-report.module';
import { PlanModule } from './modules/plan/plan.module';
import { FeishuSsoModule } from './modules/feishu-sso/feishu-sso.module';
import { IpGuard } from './guards/ip.guard';
import { PlanGuard } from './guards/plan.guard';
import { CacheModule } from './modules/cache/cache.module';
import { MonitoringModule } from './modules/monitoring/monitoring.module';
import { MetricsInterceptor } from './modules/monitoring/metrics.interceptor';

@Module({
  imports: [
    CacheModule,
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
    ProjectMembershipsModule,
    WorkItemsModule,
    MilestoneBoardModule,
    SprintModule,
    OrganizationsModule,
    TesthubModule,
    WikiModule,
    WebhooksModule,
    ApiKeysModule,
    SmartFillModule,
    DepartmentsModule,
    AutomationModule,
    CostReportModule,
    PlanModule,
    FeishuSsoModule,
    MonitoringModule
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard
    },
    {
      provide: APP_GUARD,
      useClass: OrgGuard
    },
    {
      provide: APP_GUARD,
      useClass: IpGuard
    },
    {
      provide: APP_GUARD,
      useClass: PlanGuard
    }
  ]
})
export class AppModule { }
