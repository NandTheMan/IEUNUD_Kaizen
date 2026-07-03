import { IsInt, Min } from 'class-validator';

export class ShipOrderDto {
  @IsInt()
  @Min(1)
  logSiklusId!: number;

  @IsInt()
  @Min(1)
  heijunkaId!: number;
}