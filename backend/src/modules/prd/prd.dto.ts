import { IsNotEmpty, IsNumber, IsOptional, IsString, IsNumberString } from 'class-validator';

export class CreatePrdDocumentDto {
  @IsNumber()
  projectId!: number;

  @IsString()
  @IsNotEmpty()
  title!: string;
}

export class ComparePrdDto {
  @IsNumber()
  leftVersionId!: number;

  @IsNumber()
  rightVersionId!: number;
}

export class ListPrdDocumentsQueryDto {
  @IsOptional()
  @IsNumberString()
  projectId?: string;
}
