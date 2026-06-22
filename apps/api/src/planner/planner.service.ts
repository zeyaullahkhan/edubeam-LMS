import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { AuthUser } from '@edubeam/shared';

const prisma = new PrismaClient();

@Injectable()
export class PlannerService {
  private today() {
    return new Date().toISOString().slice(0, 10);
  }

  private buildConditions(user: AuthUser) {
    const or: any[] = [];
    if (user.role === 'ADMIN') return null; // null = no filter → all holidays

    if (user.tenantId) or.push({ scope: 'TENANT', scopeId: user.tenantId });
    if (user.role !== 'STATE_OFFICIAL') {
      if (user.districtId) or.push({ scope: 'DISTRICT', scopeId: user.districtId });
      if (user.blockId)    or.push({ scope: 'BLOCK',    scopeId: user.blockId });
      if (user.schoolId)   or.push({ scope: 'SCHOOL',   scopeId: user.schoolId });
    }
    return or.length ? or : null;
  }

  async getHolidays(user: AuthUser, month?: string): Promise<any[]> {
    const or = this.buildConditions(user);
    const base: any = month ? { startDate: { startsWith: month } } : {};
    return prisma.holiday.findMany({
      where: or ? { OR: or, ...base } : base,
      orderBy: { startDate: 'asc' },
    });
  }

  async getUpcoming(user: AuthUser, limit = 5): Promise<any[]> {
    const or = this.buildConditions(user);
    const base: any = { startDate: { gte: this.today() } };
    return prisma.holiday.findMany({
      where: or ? { OR: or, ...base } : base,
      orderBy: { startDate: 'asc' },
      take: limit,
    });
  }

  async getScopeOptions(user: AuthUser) {
    if (user.role === 'ADMIN') {
      const [tenants, districts, blocks] = await Promise.all([
        prisma.tenant.findMany({ select: { id: true, name: true, code: true }, orderBy: { name: 'asc' } }),
        prisma.district.findMany({ select: { id: true, name: true, tenantId: true }, orderBy: { name: 'asc' } }),
        prisma.block.findMany({ select: { id: true, name: true, districtId: true }, orderBy: { name: 'asc' } }),
      ]);
      return { tenants, districts, blocks, schools: [] };
    }
    if (user.role === 'STATE_OFFICIAL') {
      const [districts, blocks] = await Promise.all([
        prisma.district.findMany({ where: { tenantId: user.tenantId ?? '' }, select: { id: true, name: true, tenantId: true }, orderBy: { name: 'asc' } }),
        prisma.block.findMany({ where: { district: { tenantId: user.tenantId ?? '' } }, select: { id: true, name: true, districtId: true }, orderBy: { name: 'asc' } }),
      ]);
      return { tenants: [], districts, blocks, schools: [] };
    }
    if (user.role === 'DISTRICT_OFFICIAL') {
      const blocks = await prisma.block.findMany({
        where: { districtId: user.districtId ?? '' },
        select: { id: true, name: true, districtId: true }, orderBy: { name: 'asc' },
      });
      return { tenants: [], districts: [], blocks, schools: [] };
    }
    return { tenants: [], districts: [], blocks: [], schools: [] };
  }

  async createHoliday(user: AuthUser, dto: {
    title: string; description?: string;
    startDate: string; endDate: string;
    // Admin-only: explicit scope override
    scopeLevel?: string; scopeTargetId?: string;
  }) {
    let scope: string;
    let scopeId: string | null | undefined;

    if (user.role === 'ADMIN') {
      if (!dto.scopeLevel || !dto.scopeTargetId) {
        throw new ForbiddenException('Admin must specify scope level and target');
      }
      scope = dto.scopeLevel;
      scopeId = dto.scopeTargetId;
    } else {
      switch (user.role) {
        case 'STATE_OFFICIAL':
          scope = 'TENANT'; scopeId = user.tenantId; break;
        case 'DISTRICT_OFFICIAL':
          scope = 'DISTRICT'; scopeId = user.districtId; break;
        case 'BLOCK_OFFICIAL':
          scope = 'BLOCK'; scopeId = user.blockId; break;
        case 'PRINCIPAL':
          scope = 'SCHOOL'; scopeId = user.schoolId; break;
        default:
          throw new ForbiddenException('Not authorized to create holidays');
      }
    }

    if (!scopeId) throw new ForbiddenException('No scope ID — contact admin');

    return prisma.holiday.create({
      data: {
        title: dto.title,
        description: dto.description,
        startDate: dto.startDate,
        endDate: dto.endDate,
        scope,
        scopeId,
        createdBy: user.id,
        createdByName: user.name,
      },
    });
  }

  async deleteHoliday(user: AuthUser, id: string) {
    const h = await prisma.holiday.findUnique({ where: { id } });
    if (!h) throw new NotFoundException('Holiday not found');

    const ok =
      h.createdBy === user.id ||
      user.role === 'ADMIN' ||
      (user.role === 'STATE_OFFICIAL' && h.scope === 'TENANT' && h.scopeId === user.tenantId) ||
      (user.role === 'DISTRICT_OFFICIAL' && h.scope === 'DISTRICT' && h.scopeId === user.districtId) ||
      (user.role === 'BLOCK_OFFICIAL' && h.scope === 'BLOCK' && h.scopeId === user.blockId) ||
      (user.role === 'PRINCIPAL' && h.scope === 'SCHOOL' && h.scopeId === user.schoolId);

    if (!ok) throw new ForbiddenException('Not authorized to delete this holiday');
    await prisma.holiday.delete({ where: { id } });
    return { ok: true };
  }
}
