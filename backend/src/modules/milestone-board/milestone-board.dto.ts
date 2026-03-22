import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';

export class MilestoneBoardDeliverableInputDto {
  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsOptional()
  @IsBoolean()
  done?: boolean;
}

export class CreateMilestoneBoardItemDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  owner!: string;

  @IsString()
  @IsNotEmpty()
  due!: string;

  @IsOptional()
  @IsIn(['upcoming', 'in_progress', 'completed'])
  status?: 'upcoming' | 'in_progress' | 'completed';

  @IsOptional()
  @IsIn(['low', 'medium', 'high'])
  risk?: 'low' | 'medium' | 'high';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  progress?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => MilestoneBoardDeliverableInputDto)
  deliverables?: MilestoneBoardDeliverableInputDto[];
}

export class UpdateMilestoneBoardItemDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  owner?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  due?: string;

  @IsOptional()
  @IsIn(['upcoming', 'in_progress', 'completed'])
  status?: 'upcoming' | 'in_progress' | 'completed';

  @IsOptional()
  @IsIn(['low', 'medium', 'high'])
  risk?: 'low' | 'medium' | 'high';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  progress?: number;
}

export class AddMilestoneBoardDeliverableDto {
  @IsString()
  @IsNotEmpty()
  content!: string;
}

export class UpdateMilestoneBoardDeliverableDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  content?: string;

  @IsOptional()
  @IsBoolean()
  done?: boolean;
}

export class ImportMilestoneBoardLocalDto {
  @IsOptional()
  @IsString()
  migrationToken?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMilestoneBoardItemDto)
  items!: CreateMilestoneBoardItemDto[];
}
