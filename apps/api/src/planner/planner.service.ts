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

  // ── Notices ──────────────────────────────────────────────────────────────────

  /** Build OR filter so a school sees its own + broader-scope notices */
  private async noticeVisibilityWhere(schoolId: string) {
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { blockId: true, block: { select: { districtId: true, district: { select: { tenantId: true } } } } },
    });
    const blockId    = school?.blockId ?? null;
    const districtId = school?.block?.districtId ?? null;
    const tenantId   = school?.block?.district?.tenantId ?? null;

    return {
      OR: [
        { scope: 'school', schoolId },
        ...(blockId    ? [{ scope: 'block',    blockId    }] : []),
        ...(districtId ? [{ scope: 'district', districtId }] : []),
        ...(tenantId   ? [{ scope: 'all',      tenantId   }] : []),
      ],
    };
  }

  async getNotices(user: AuthUser, schoolId?: string): Promise<any[]> {
    const today = this.today();
    const sid = schoolId ?? user.schoolId;
    if (!sid) return [];
    const visWhere = await this.noticeVisibilityWhere(sid);
    return prisma.notice.findMany({
      where: {
        AND: [
          visWhere,
          { publishDate: { lte: today } },
          { OR: [{ expiryDate: null }, { expiryDate: { gte: today } }] },
        ],
      },
      orderBy: { publishDate: 'desc' },
    });
  }

  async getAllNotices(user: AuthUser, schoolId?: string): Promise<any[]> {
    const sid = schoolId ?? user.schoolId;
    if (!sid) return [];
    const visWhere = await this.noticeVisibilityWhere(sid);
    return prisma.notice.findMany({
      where: visWhere,
      orderBy: { publishDate: 'desc' },
    });
  }

  async createNotice(user: AuthUser, dto: {
    title: string; description?: string; type?: string;
    publishDate: string; expiryDate?: string;
    scope?: string; schoolId?: string; blockId?: string; districtId?: string;
  }) {
    const WRITE_ROLES = ['ADMIN', 'STATE_OFFICIAL', 'DISTRICT_OFFICIAL', 'PRINCIPAL'];
    if (!WRITE_ROLES.includes(user.role)) throw new ForbiddenException('Not authorized to create notices');

    const scope = dto.scope ?? 'school';
    let schoolId: string | null = null;
    let blockId: string | null = null;
    let districtId: string | null = null;
    let tenantId: string | null = null;

    if (scope === 'school') {
      schoolId = dto.schoolId ?? user.schoolId ?? null;
      if (!schoolId) throw new ForbiddenException('schoolId required for school-scoped notice');
    } else if (scope === 'block') {
      blockId = dto.blockId ?? user.blockId ?? null;
      if (!blockId) throw new ForbiddenException('blockId required');
    } else if (scope === 'district') {
      districtId = dto.districtId ?? user.districtId ?? null;
      if (!districtId) throw new ForbiddenException('districtId required');
    } else if (scope === 'all') {
      tenantId = user.tenantId ?? null;
      if (!tenantId) throw new ForbiddenException('tenantId required');
    }

    return prisma.notice.create({
      data: {
        scope,
        schoolId,
        blockId,
        districtId,
        tenantId,
        title: dto.title,
        description: dto.description,
        type: dto.type ?? 'General',
        publishDate: dto.publishDate,
        expiryDate: dto.expiryDate,
        createdById: user.id,
        createdByName: user.name,
      },
    });
  }

  async updateNotice(user: AuthUser, id: string, dto: any) {
    const notice = await prisma.notice.findUnique({ where: { id } });
    if (!notice) throw new NotFoundException('Notice not found');
    const ok = user.role === 'ADMIN' || notice.createdById === user.id;
    if (!ok) throw new ForbiddenException('Not authorized');
    return prisma.notice.update({ where: { id }, data: dto });
  }

  async deleteNotice(user: AuthUser, id: string) {
    const notice = await prisma.notice.findUnique({ where: { id } });
    if (!notice) throw new NotFoundException('Notice not found');
    const ok = user.role === 'ADMIN' || notice.createdById === user.id;
    if (!ok) throw new ForbiddenException('Not authorized');
    await prisma.notice.delete({ where: { id } });
    return { ok: true };
  }

  // ── Events ──────────────────────────────────────────────────────────────────

  async getEvents(user: AuthUser, month?: string): Promise<any[]> {
    const or = this.buildConditions(user);
    const base: any = month ? { date: { startsWith: month } } : {};
    return prisma.event.findMany({
      where: or ? { OR: or, ...base } : base,
      orderBy: { date: 'asc' },
    });
  }

  async createEvent(user: AuthUser, dto: {
    title: string; description?: string; type?: string;
    date: string; endDate?: string; urgent?: boolean;
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
        case 'STATE_OFFICIAL':   scope = 'TENANT';   scopeId = user.tenantId; break;
        case 'DISTRICT_OFFICIAL':scope = 'DISTRICT'; scopeId = user.districtId; break;
        case 'BLOCK_OFFICIAL':   scope = 'BLOCK';    scopeId = user.blockId; break;
        case 'PRINCIPAL':        scope = 'SCHOOL';   scopeId = user.schoolId; break;
        default: throw new ForbiddenException('Not authorized to create events');
      }
    }

    if (!scopeId) throw new ForbiddenException('No scope ID — contact admin');

    return prisma.event.create({
      data: {
        title: dto.title,
        description: dto.description,
        type: dto.type ?? 'Other',
        date: dto.date,
        endDate: dto.endDate,
        urgent: dto.urgent ?? false,
        scope,
        scopeId,
        createdBy: user.id,
        createdByName: user.name,
      },
    });
  }

  async deleteEvent(user: AuthUser, id: string) {
    const ev = await prisma.event.findUnique({ where: { id } });
    if (!ev) throw new NotFoundException('Event not found');

    const ok =
      ev.createdBy === user.id ||
      user.role === 'ADMIN' ||
      (user.role === 'STATE_OFFICIAL' && ev.scope === 'TENANT' && ev.scopeId === user.tenantId) ||
      (user.role === 'DISTRICT_OFFICIAL' && ev.scope === 'DISTRICT' && ev.scopeId === user.districtId) ||
      (user.role === 'BLOCK_OFFICIAL' && ev.scope === 'BLOCK' && ev.scopeId === user.blockId) ||
      (user.role === 'PRINCIPAL' && ev.scope === 'SCHOOL' && ev.scopeId === user.schoolId);

    if (!ok) throw new ForbiddenException('Not authorized to delete this event');
    await prisma.event.delete({ where: { id } });
    return { ok: true };
  }
}
