import { IsNotEmpty, IsString } from 'class-validator';

export class ReportNgDto {
  @IsString()
  @IsNotEmpty()
  alasan_ng: string;
}