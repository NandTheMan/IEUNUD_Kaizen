import { IsInt, IsPositive } from 'class-validator';

export class DecrementStockDto {
  @IsInt()
  id_bahan: number;

  @IsInt()
  @IsPositive()
  jumlah: number;
}