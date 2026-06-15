import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { prisma } from '@edubeam/db';
import type { AuthUser, Role } from '@edubeam/shared';

@Injectable()
export class AuthService {
  constructor(private readonly jwt: JwtService) {}

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
      schoolId: user.schoolId,
      studentId: user.studentId ?? null,
      linkedStudentIds: user.linkedStudentIds ?? null,
    });
    return { token, user: authUser };
  }
}
