import { ForbiddenException } from '@nestjs/common';
import { prisma } from '@edubeam/db';
import type { AuthUser } from '@edubeam/shared';
import { schoolScope } from '../analytics/scope';

/** Roles allowed to create/update/delete registry records. */
const WRITE_ROLES = ['ADMIN', 'STATE_OFFICIAL', 'DISTRICT_OFFICIAL', 'PRINCIPAL'];

export function canWrite(user: AuthUser): boolean {
  return WRITE_ROLES.includes(user.role);
}

export function assertCanWrite(user: AuthUser) {
  if (!canWrite(user)) throw new ForbiddenException('You do not have permission to modify the registry');
}

/**
 * Ensures the target school is within the caller's data scope, returning its id.
 * School-scoped users are pinned to their own school regardless of the requested id.
 */
export async function resolveWritableSchool(user: AuthUser, requestedSchoolId?: string): Promise<string> {
  const { schoolWhere, schoolId } = schoolScope(user);
  if (schoolId) return schoolId; // school-level user — always their own school
  const target = requestedSchoolId;
  if (!target) throw new ForbiddenException('A school must be specified');
  const ok = await prisma.school.findFirst({ where: { id: target, ...schoolWhere }, select: { id: true } });
  if (!ok) throw new ForbiddenException('School is outside your scope');
  return target;
}
