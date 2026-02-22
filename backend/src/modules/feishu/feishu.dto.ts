import { IsBooleanString, IsNumberString, IsOptional, IsString } from 'class-validator';

export class ListRecordsQueryDto {
  @IsOptional()
  @IsNumberString()
  pageSize?: string;

  @IsOptional()
  @IsString()
  pageToken?: string;

  @IsOptional()
  @IsString()
  viewId?: string;

  @IsOptional()
  @IsString()
  filter?: string;

  @IsOptional()
  @IsString()
  sort?: string;

  @IsOptional()
  @IsString()
  fieldNames?: string;

  @IsOptional()
  @IsBooleanString()
  textFieldAsArray?: string;

  @IsOptional()
  @IsBooleanString()
  displayFormulaRef?: string;

  @IsOptional()
  @IsBooleanString()
  automaticFields?: string;

  @IsOptional()
  @IsString()
  userIdType?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  searchFields?: string;

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
