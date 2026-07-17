import { IsOptional, IsString } from 'class-validator';

export class ReportAndonDto {
  @IsString()
  @IsOptional()
  message?: string;
}