import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { prisma } from '@edubeam/db';
import { ROLES, type AuthUser, type Role } from '@edubeam/shared';

interface CreateUserDto {
  email: string;
  name: string;
  password: string;
  role: Role;
  districtId?: string | null;
  blockId?: string | null;
  schoolId?: string | null;
  studentId?: string | null;
  linkedStudentIds?: string | null;
}

type UpdateUserDto = Partial<Omit<CreateUserDto, 'email'>> & { active?: boolean; studentId?: string | null; linkedStudentIds?: string | null };

const SCHOOL_ROLES: Role[] = ['PRINCIPAL', 'TEACHER', 'STUDENT', 'PARENT'];

@Injectable()
export class UsersService {
  async list(admin: AuthUser, opts: { q?: string; role?: string; districtId?: string; blockId?: string; schoolId?: string; page?: number }) {
    const PAGE_SIZE = 50;
    const page = Math.max(1, opts.page ?? 1);
    const where = {
      tenantId: admin.tenantId,
      ...(opts.role ? { role: opts.role } : {}),
      ...(opts.districtId ? { districtId: opts.districtId } : {}),
      ...(opts.blockId ? { blockId: opts.blockId } : {}),
      ...(opts.schoolId ? { schoolId: opts.schoolId } : {}),
      ...(opts.q ? { OR: [{ name: { contains: opts.q } }, { email: { contains: opts.q } }] } : {}),
    };
    const [total, rows] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: { district: true, block: true, school: true },
      }),
    ]);
    return {
      total,
      page,
      pages: Math.ceil(total / PAGE_SIZE),
      users: rows.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        active: u.active,
        districtId: u.districtId,
        district: u.district?.name ?? null,
        blockId: u.blockId,
        block: u.block?.name ?? null,
        schoolId: u.schoolId,
        school: u.school?.name ?? null,
        createdAt: u.createdAt,
      })),
    };
  }

  private validateScope(role: Role, districtId?: string | null, blockId?: string | null, schoolId?: string | null) {
    if (!ROLES.includes(role)) throw new BadRequestException('Invalid role');
    if (role === 'DISTRICT_OFFICIAL' && !districtId)
      throw new BadRequestException('District officials require a district');
    if (role === 'BLOCK_OFFICIAL' && !blockId)
      throw new BadRequestException('Block officials require a block');
    if (SCHOOL_ROLES.includes(role) && !schoolId)
      throw new BadRequestException(`${role} requires a school`);
  }

  async create(admin: AuthUser, dto: CreateUserDto) {
    const email = dto.email.toLowerCase().trim();
    if (!email || !dto.password || !dto.name) throw new BadRequestException('Missing fields');
    if (await prisma.user.findUnique({ where: { email } }))
      throw new BadRequestException('Email already in use');
    this.validateScope(dto.role, dto.districtId, dto.blockId, dto.schoolId);

    const isUpperRole = dto.role === 'STATE_OFFICIAL' || dto.role === 'ADMIN';
    const user = await prisma.user.create({
      data: {
        email,
        name: dto.name.trim(),
        passwordHash: await bcrypt.hash(dto.password, 10),
        role: dto.role,
        tenantId: admin.tenantId,
        districtId: isUpperRole ? null : dto.districtId ?? null,
        blockId: dto.role === 'BLOCK_OFFICIAL' ? dto.blockId ?? null : null,
        schoolId: SCHOOL_ROLES.includes(dto.role) ? dto.schoolId ?? null : null,
        studentId: dto.role === 'STUDENT' ? (dto.studentId ?? null) : null,
        linkedStudentIds: dto.role === 'PARENT' ? (dto.linkedStudentIds ?? null) : null,
      },
    });
    return { id: user.id };
  }

  async update(admin: AuthUser, id: string, dto: UpdateUserDto) {
    const user = await prisma.user.findFirst({ where: { id, tenantId: admin.tenantId } });
    if (!user) throw new NotFoundException('User not found');
    const role = (dto.role ?? user.role) as Role;
    if (dto.role || dto.districtId !== undefined || dto.blockId !== undefined || dto.schoolId !== undefined) {
      this.validateScope(role, dto.districtId ?? user.districtId, dto.blockId ?? user.blockId, dto.schoolId ?? user.schoolId);
    }
    const isUpperRole = role === 'STATE_OFFICIAL' || role === 'ADMIN';
    await prisma.user.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        role: dto.role,
        active: dto.active,
        districtId: dto.role && isUpperRole ? null : dto.districtId,
        blockId: dto.role && role !== 'BLOCK_OFFICIAL' ? null : dto.blockId,
        schoolId: dto.role && !SCHOOL_ROLES.includes(role) ? null : dto.schoolId,
        studentId: dto.studentId !== undefined ? dto.studentId : undefined,
        linkedStudentIds: dto.linkedStudentIds !== undefined ? dto.linkedStudentIds : undefined,
        ...(dto.password ? { passwordHash: await bcrypt.hash(dto.password, 10) } : {}),
      },
    });
    return { ok: true };
  }

  async remove(admin: AuthUser, id: string) {
    if (id === admin.id) throw new BadRequestException('You cannot delete your own account');
    const user = await prisma.user.findFirst({ where: { id, tenantId: admin.tenantId } });
    if (!user) throw new NotFoundException('User not found');
    await prisma.user.delete({ where: { id } });
    return { ok: true };
  }
}
