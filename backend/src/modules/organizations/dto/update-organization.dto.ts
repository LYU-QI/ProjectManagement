import { IsString, IsOptional, IsEnum, IsNumber, Min } from 'class-validator';

export class UpdateOrganizationDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(['FREE', 'PRO', 'ENTERPRISE'])
  plan?: 'FREE' | 'PRO' | 'ENTERPRISE';

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxMembers?: number;
}
