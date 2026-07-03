import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; // Assuming you have a PrismaService

@Injectable()
export class ScenariosService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.skenarioGame.findMany();
  }
}
