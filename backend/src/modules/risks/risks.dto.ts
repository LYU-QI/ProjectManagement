import { IsBooleanString, IsNumberString, IsOptional, IsString } from 'class-validator';

export class ListRisksQueryDto {
  @IsOptional()
  @IsNumberString()
  thresholdDays?: string;

  @IsOptional()
  @IsNumberString()
  progressThreshold?: string;

  @IsOptional()
  @IsString()
  viewId?: string;

  @IsOptional()
  @IsString()
  filterProject?: string;

  @IsOptional()
  @IsString()
  filterStatus?: string;

  @IsOptional()
  @IsString()
  filterAssignee?: string;

  @IsOptional()
  @IsString()
  filterRisk?: string;

  @IsOptional()
  @IsBooleanString()
  includeMilestones?: string;
}

export class UpdateRiskRuleDto {
  @IsOptional()
  @IsString()
  key?: string;

  @IsOptional()
  @IsNumberString()
  thresholdDays?: string;

  @IsOptional()
  @IsNumberString()
  progressThreshold?: string;

  @IsOptional()
  @IsBooleanString()
  includeMilestones?: string;

  @IsOptional()
  @IsBooleanString()
  autoNotify?: string;

  @IsOptional()
  @IsBooleanString()
  enabled?: string;

  @IsOptional()
  @IsString()
  blockedValue?: string;
}

export class ListAllRisksQueryDto {
  @IsOptional()
  @IsString()
  viewId?: string;

  @IsOptional()
  @IsString()
  filterProject?: string;

  @IsOptional()
  @IsString()
  filterStatus?: string;

  @IsOptional()
  @IsString()
  filterAssignee?: string;

  @IsOptional()
  @IsString()
  filterRisk?: string;
}
