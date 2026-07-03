import { IsInt, IsNotEmpty } from 'class-validator';

export class CreateSessionDto {
  @IsNotEmpty()
  @IsInt()
  id_skenario!: number;
}
