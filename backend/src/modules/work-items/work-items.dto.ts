import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min, ValidateIf } from 'class-validator';

export class CreateWorkItemDto {
  @IsOptional()
  @IsNumber()
  projectId?: number;

  @IsNotEmpty()
  @IsString()
  title!: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  description?: string | null;

  @IsIn(['todo', 'issue'])
  type!: 'todo' | 'issue';

  @IsOptional()
  @IsIn(['low', 'medium', 'high'])
  priority?: 'low' | 'medium' | 'high';

  @IsOptional()
  @IsNumber()
  assigneeId?: number;

  @IsOptional()
  @IsString()
  assigneeName?: string;

  @IsOptional()
  @IsString()
  dueDate?: string;

  @IsOptional()
  @IsNumber()
  parentId?: number;
}

export class UpdateWorkItemDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['todo', 'issue'])
  type?: 'todo' | 'issue';

  @IsOptional()
  @IsIn(['low', 'medium', 'high'])
  priority?: 'low' | 'medium' | 'high';

  @IsOptional()
  @IsIn(['todo', 'in_progress', 'in_review', 'done', 'closed'])
  status?: 'todo' | 'in_progress' | 'in_review' | 'done' | 'closed';

  @IsOptional()
  @IsNumber()
  assigneeId?: number | null;

  @IsOptional()
  @IsString()
  assigneeName?: string | null;

  @IsOptional()
  @IsString()
  dueDate?: string | null;

  @IsOptional()
  @IsNumber()
  parentId?: number | null;
}

export class ListWorkItemsQueryDto {
  @IsOptional()
  @IsNumber()
  projectId?: number;

  @IsOptional()
  @IsIn(['project', 'personal', 'all'])
  scope?: 'project' | 'personal' | 'all';

  @IsOptional()
  @IsIn(['todo', 'in_progress', 'in_review', 'done', 'closed'])
  status?: 'todo' | 'in_progress' | 'in_review' | 'done' | 'closed';

  @IsOptional()
  @IsIn(['todo', 'issue'])
  type?: 'todo' | 'issue';

  @IsOptional()
  @IsIn(['low', 'medium', 'high'])
  priority?: 'low' | 'medium' | 'high';

  @IsOptional()
  @IsNumber()
  assigneeId?: number;

  @IsOptional()
  @IsString()
  assigneeName?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsNumber()
  parentId?: number;

  @IsOptional()
  @IsIn(['true', 'false'])
  hasParent?: 'true' | 'false';

  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(200)
  pageSize?: number;
}
