import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateTestCaseDto {
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
  preconditions?: string;

  @IsOptional()
  steps?: object[];

  @IsOptional()
  @IsString()
  expectedResult?: string;

  @IsOptional()
  @IsIn(['low', 'medium', 'high', 'critical'])
  priority?: 'low' | 'medium' | 'high' | 'critical';

  @IsOptional()
  @IsIn(['draft', 'active', 'deprecated'])
  status?: 'draft' | 'active' | 'deprecated';

  @IsOptional()
  @IsString()
  tags?: string;
}

export class UpdateTestCaseDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  preconditions?: string;

  @IsOptional()
  steps?: object[];

  @IsOptional()
  @IsString()
  expectedResult?: string;

  @IsOptional()
  @IsIn(['low', 'medium', 'high', 'critical'])
  priority?: 'low' | 'medium' | 'high' | 'critical';

  @IsOptional()
  @IsIn(['draft', 'active', 'deprecated'])
  status?: 'draft' | 'active' | 'deprecated';

  @IsOptional()
  @IsString()
  tags?: string;
}

export class ListTestCaseQueryDto {
  @IsOptional()
  projectId?: number;

  @IsOptional()
  status?: string;

  @IsOptional()
  priority?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  tags?: string;

  @IsOptional()
  page?: number;

  @IsOptional()
  pageSize?: number;
}
