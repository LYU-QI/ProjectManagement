import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateTestPlanDto {
  @IsNumber()
  projectId!: number;

  @IsNotEmpty()
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['draft', 'active', 'completed', 'archived'])
  status?: 'draft' | 'active' | 'completed' | 'archived';

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}

export class UpdateTestPlanDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['draft', 'active', 'completed', 'archived'])
  status?: 'draft' | 'active' | 'completed' | 'archived';

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}

export class ListTestPlanQueryDto {
  @IsOptional()
  projectId?: number;

  @IsOptional()
  status?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  page?: number;

  @IsOptional()
  pageSize?: number;
}

export class AddTestCasesDto {
  @IsNumber({}, { each: true })
  testCaseIds!: number[];
}

export class ExecuteTestCaseDto {
  @IsOptional()
  @IsIn(['passed', 'failed', 'blocked', 'skipped'])
  result?: 'passed' | 'failed' | 'blocked' | 'skipped';

  @IsOptional()
  @IsString()
  notes?: string;
}
