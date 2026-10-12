import { Injectable } from '@nestjs/common';
import { UserStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class BakeriesService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: {
        userId,
        status: UserStatus.ACTIVE,
        bakery: { status: 'ACTIVE' },
      },
      select: {
        role: true,
        bakery: { select: { id: true, name: true } },
      },
      orderBy: { bakery: { name: 'asc' } },
    });

    return memberships.map(({ bakery, role }) => ({
      id: bakery.id,
      name: bakery.name,
      role,
    }));
  }
}
