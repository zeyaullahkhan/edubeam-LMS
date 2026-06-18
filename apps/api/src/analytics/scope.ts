import { ForbiddenException } from '@nestjs/common';
import { prisma, type Prisma } from '@edubeam/db';
import { scopeOf, type AuthUser, type KpiScope } from '@edubeam/shared';

/**
 * Builds a Prisma `School` where-filter enforcing the user's data scope, and
 * narrows an optionally-requested districtId so a district official can never
 * read another district. Returns the effective districtId filter too.
 */
export function schoolScope(
  user: AuthUser,
  requestedDistrictId?: string,
): { schoolWhere: Prisma.SchoolWhereInput; districtId?: string; blockId?: string; schoolId?: string } {
  const scope = scopeOf(user);

  if (scope.level === 'platform') {
    return requestedDistrictId
      ? { schoolWhere: { block: { districtId: requestedDistrictId } }, districtId: requestedDistrictId }
      : { schoolWhere: {} };
  }

  if (scope.level === 'tenant') {
    const tenantFilter = scope.tenantId
      ? { block: { district: { tenantId: scope.tenantId } } }
      : {};
    if (requestedDistrictId) {
      return {
        schoolWhere: { block: { districtId: requestedDistrictId } },
        districtId: requestedDistrictId,
      };
    }
    return { schoolWhere: tenantFilter };
  }

  if (scope.level === 'district') {
    if (!scope.districtId) throw new ForbiddenException('No district assigned');
    if (requestedDistrictId && requestedDistrictId !== scope.districtId) {
      throw new ForbiddenException('Outside your district');
    }
    return { schoolWhere: { block: { districtId: scope.districtId } }, districtId: scope.districtId };
  }

  if (scope.level === 'block') {
    if (!scope.blockId) throw new ForbiddenException('No block assigned');
    if (requestedDistrictId && requestedDistrictId !== scope.districtId) {
      throw new ForbiddenException('Outside your district');
    }
    return { schoolWhere: { blockId: scope.blockId }, blockId: scope.blockId, districtId: scope.districtId ?? undefined };
  }

  // school-level
  if (!scope.schoolId) throw new ForbiddenException('No school assigned');
  return { schoolWhere: { id: scope.schoolId }, schoolId: scope.schoolId };
}

/**
 * Resolves an analytics scope from optional district/block/school query params,
 * enforcing the caller's RBAC ceiling, and returns the matching school filter
 * plus a human label. A district official cannot escape their district, etc.
 */
export async function resolveScope(
  user: AuthUser,
  req: { districtId?: string; blockId?: string; schoolId?: string },
): Promise<{ scope: KpiScope; schoolWhere: Prisma.SchoolWhereInput }> {
  const ceiling = scopeOf(user);

  // Pin requested filters to the caller's ceiling.
  let districtId = req.districtId;
  let blockId = req.blockId;
  let schoolId = req.schoolId;

  if (ceiling.level === 'district') {
    if (districtId && districtId !== ceiling.districtId) throw new ForbiddenException('Outside your district');
    districtId = ceiling.districtId ?? undefined;
  } else if (ceiling.level === 'block') {
    if (districtId && districtId !== ceiling.districtId) throw new ForbiddenException('Outside your district');
    if (blockId && blockId !== ceiling.blockId) throw new ForbiddenException('Outside your block');
    districtId = ceiling.districtId ?? undefined;
    blockId = ceiling.blockId ?? undefined;
  } else if (ceiling.level === 'school') {
    schoolId = ceiling.schoolId ?? undefined;
    districtId = user.districtId ?? undefined;
    blockId = undefined;
  }

  // Most specific filter wins.
  if (schoolId) {
    const s = await prisma.school.findUnique({
      where: { id: schoolId },
      include: { block: { include: { district: true } } },
    });
    if (!s) throw new ForbiddenException('Unknown school');
    return {
      scope: {
        level: 'school',
        label: s.name,
        districtId: s.block.districtId,
        blockId: s.blockId,
        schoolId: s.id,
      },
      schoolWhere: { id: s.id },
    };
  }
  if (blockId) {
    const b = await prisma.block.findUnique({ where: { id: blockId }, include: { district: true } });
    if (!b) throw new ForbiddenException('Unknown block');
    return {
      scope: { level: 'block', label: `${b.name} (block)`, districtId: b.districtId, blockId: b.id },
      schoolWhere: { blockId: b.id },
    };
  }
  if (districtId) {
    const d = await prisma.district.findUnique({ where: { id: districtId } });
    if (!d) throw new ForbiddenException('Unknown district');
    return {
      scope: { level: 'district', label: `${d.name} (district)`, districtId: d.id },
      schoolWhere: { block: { districtId: d.id } },
    };
  }
  // Dynamic label — fetch tenant name for STATE_OFFICIAL; platform-wide for ADMIN.
  if (ceiling.level === 'platform') {
    return { scope: { level: 'state', label: 'All States (platform-wide)' }, schoolWhere: {} };
  }
  const tenantLabel = ceiling.tenantId
    ? (await prisma.tenant.findUnique({ where: { id: ceiling.tenantId }, select: { name: true } }))?.name ?? 'State'
    : 'State';
  const tenantWhere = ceiling.tenantId
    ? { block: { district: { tenantId: ceiling.tenantId } } }
    : {};
  return { scope: { level: 'state', label: `${tenantLabel} (statewide)` }, schoolWhere: tenantWhere };
}

/** District where-filter matching the user's scope (for listing districts). */
export function districtScope(user: AuthUser): Prisma.DistrictWhereInput {
  const scope = scopeOf(user);
  if (scope.level === 'platform') return {};
  if (scope.level === 'tenant') return scope.tenantId ? { tenantId: scope.tenantId } : {};
  if (scope.level === 'district') return { id: scope.districtId ?? '__none__' };
  return { id: user.districtId ?? '__none__' };
}
