import { IsNotEmpty, IsNumber, IsOptional, IsString, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';

export enum WikiPageTypeEnum {
  document = 'document',
  folder = 'folder',
}

export class CreateWikiPageDto {
  @IsNumber()
  @Transform(({ value }) => Number(value))
  projectId!: number;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => (value !== undefined && value !== null ? Number(value) : undefined))
  parentId?: number;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsEnum(WikiPageTypeEnum)
  type?: WikiPageTypeEnum;
}

export class UpdateWikiPageDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => (value !== undefined && value !== null ? Number(value) : undefined))
  parentId?: number | null;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => (value !== undefined && value !== null ? Number(value) : undefined))
  sortOrder?: number;
}

export class ListWikiPageQueryDto {
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => (value !== undefined && value !== null ? Number(value) : undefined))
  projectId?: number;
}
