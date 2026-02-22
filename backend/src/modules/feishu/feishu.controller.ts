import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { FeishuService } from './feishu.service';
import { ListRecordsQueryDto } from './feishu.dto';
import { Roles } from '../auth/roles.decorator';

@Controller('api/v1/feishu')
export class FeishuController {
  constructor(private readonly feishuService: FeishuService) {}

  @Get('records')
  async listRecords(@Query() query: ListRecordsQueryDto) {
    return this.feishuService.listRecords({
      pageSize: query.pageSize ? Number(query.pageSize) : undefined,
      pageToken: query.pageToken,
      viewId: query.viewId,
      filter: query.filter,
      sort: query.sort,
      fieldNames: query.fieldNames,
      textFieldAsArray: query.textFieldAsArray ? query.textFieldAsArray === 'true' : undefined,
      displayFormulaRef: query.displayFormulaRef ? query.displayFormulaRef === 'true' : undefined,
      automaticFields: query.automaticFields ? query.automaticFields === 'true' : undefined,
      userIdType: query.userIdType,
      search: query.search,
      searchFields: query.searchFields,
      filterProject: query.filterProject,
      filterStatus: query.filterStatus,
      filterAssignee: query.filterAssignee,
      filterRisk: query.filterRisk
    });
  }

  @Post('records')
  @Roles('pm', 'lead')
  async createRecord(@Body('fields') fields: Record<string, unknown>) {
    return this.feishuService.createRecord(fields || {});
  }

  @Put('records/:recordId')
  @Roles('pm', 'lead')
  async updateRecord(@Param('recordId') recordId: string, @Body('fields') fields: Record<string, unknown>) {
    return this.feishuService.updateRecord(recordId, fields || {});
  }

  @Delete('records/:recordId')
  @Roles('pm', 'lead')
  async deleteRecord(@Param('recordId') recordId: string) {
    return this.feishuService.deleteRecord(recordId);
  }
}
