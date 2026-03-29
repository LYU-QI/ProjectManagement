import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateBugDto {
  @IsNumber()
  projectId!: number;

  @IsNotEmpty()
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  steps?: string;

  @IsOptional()
  @IsIn(['trivial', 'minor', 'major', 'critical', 'blocker'])
  severity?: 'trivial' | 'minor' | 'major' | 'critical' | 'blocker';

  @IsOptional()
  @IsIn(['low', 'medium', 'high', 'urgent'])
  priority?: 'low' | 'medium' | 'high' | 'urgent';

  @IsOptional()
  @IsNumber()
  testCaseId?: number;

  @IsOptional()
  @IsNumber()
  assigneeId?: number;

  @IsOptional()
  @IsString()
  assigneeName?: string;
}

export class UpdateBugDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  steps?: string;

  @IsOptional()
  @IsIn(['trivial', 'minor', 'major', 'critical', 'blocker'])
  severity?: 'trivial' | 'minor' | 'major' | 'critical' | 'blocker';

  @IsOptional()
  @IsIn(['low', 'medium', 'high', 'urgent'])
  priority?: 'low' | 'medium' | 'high' | 'urgent';

  @IsOptional()
  @IsIn(['open', 'in_progress', 'resolved', 'closed', 'rejected'])
  status?: 'open' | 'in_progress' | 'resolved' | 'closed' | 'rejected';

  @IsOptional()
  @IsNumber()
  assigneeId?: number | null;

  @IsOptional()
  @IsString()
  assigneeName?: string | null;
}

export class ListBugQueryDto {
  @IsOptional()
  projectId?: number;

  @IsOptional()
  status?: string;

  @IsOptional()
  severity?: string;

  @IsOptional()
  priority?: string;

  @IsOptional()
  assigneeId?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  page?: number;

  @IsOptional()
  pageSize?: number;
}
