import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { prisma } from '@edubeam/db';
import type { AuthUser, Role } from '@edubeam/shared';

@Injectable()
export class AuthService {
  constructor(private readonly jwt: JwtService) {}

  /** Change the logged-in user's own password (all roles). Requires the current password. */
  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    if (!currentPassword || !newPassword) throw new BadRequestException('Both current and new password are required');
    if (String(newPassword).length < 6) throw new BadRequestException('New password must be at least 6 characters');

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Account not found');
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new BadRequestException('Current password is incorrect');
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    return { ok: true };
  }

  async login(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!user.active) throw new UnauthorizedException('This account has been deactivated');
    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as Role,
      tenantId: user.tenantId,
      districtId: user.districtId,
      blockId: user.blockId,
      schoolId: user.schoolId,
      studentId: user.studentId,
      linkedStudentIds: user.linkedStudentIds,
    };
    const token = this.jwt.sign({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId,
      districtId: user.districtId,
      blockId: user.blockId ?? null,
      schoolId: user.schoolId,
      studentId: user.studentId ?? null,
      linkedStudentIds: user.linkedStudentIds ?? null,
    });
    return { token, user: authUser };
  }
}
