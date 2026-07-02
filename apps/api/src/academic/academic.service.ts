import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { AuthUser } from '@edubeam/shared';
import { resolveWritableSchool } from '../people/people.scope';
import { schoolScope } from '../analytics/scope';

const prisma = new PrismaClient();

@Injectable()
export class AcademicService {

  // ── Teacher Allocation (SubjectAssignment) ─────────────────────────────────

  async listAllocations(user: AuthUser, schoolId?: string, academicYear?: string) {
    const { schoolWhere, schoolId: userSchoolId } = schoolScope(user);
    const sid = userSchoolId ?? schoolId;
    return prisma.subjectAssignment.findMany({
      where: {
        classSection: {
          ...(sid ? { schoolId: sid } : { school: schoolWhere }),
          ...(academicYear ? { academicYear } : {}),
        },
      },
      include: { classSection: true, subject: true },
      orderBy: [{ classSection: { grade: 'asc' } }],
    });
  }

  async createAllocation(user: AuthUser, dto: {
    schoolId?: string; staffId: string; classSectionId: string;
    subjectId: string; academicYear: string;
  }) {
    const classSection = await prisma.classSection.findUnique({ where: { id: dto.classSectionId } });
    if (!classSection) throw new NotFoundException('Class section not found');
    await resolveWritableSchool(user, classSection.schoolId);
    return prisma.subjectAssignment.create({
      data: {
        staffId: dto.staffId,
        classSectionId: dto.classSectionId,
        subjectId: dto.subjectId,
        academicYear: dto.academicYear,
      },
      include: { classSection: true, subject: true },
    });
  }

  async removeAllocation(user: AuthUser, id: string) {
    const existing = await prisma.subjectAssignment.findUnique({
      where: { id },
      include: { classSection: true },
    });
    if (!existing) throw new NotFoundException('Allocation not found');
    await resolveWritableSchool(user, existing.classSection.schoolId);
    return prisma.subjectAssignment.delete({ where: { id } });
  }

  // ── Homework ───────────────────────────────────────────────────────────────

  async listHomework(user: AuthUser, params: {
    schoolId?: string; grade?: number; academicYear?: string;
  }) {
    const { schoolWhere, schoolId: userSchoolId } = schoolScope(user);
    const sid = userSchoolId ?? params.schoolId;
    const gradeFilter = params.grade
      ? { grade: { lte: params.grade }, OR: [{ gradeTo: null }, { gradeTo: { gte: params.grade } }] }
      : {};
    return prisma.homework.findMany({
      where: {
        ...(sid ? { schoolId: sid } : { school: { ...schoolWhere } }),
        ...gradeFilter,
        ...(params.academicYear ? { academicYear: params.academicYear } : {}),
      },
      include: { _count: { select: { submissions: true } } },
      orderBy: { dueDate: 'asc' },
    });
  }

  async createHomework(user: AuthUser, dto: {
    schoolId?: string; grade: number; gradeTo?: number; subject: string;
    title: string; description?: string; dueDate: string;
    attachmentUrl?: string; academicYear: string;
  }) {
    const sid = await resolveWritableSchool(user, dto.schoolId);
    return prisma.homework.create({
      data: {
        schoolId: sid,
        grade: dto.grade,
        gradeTo: dto.gradeTo ?? null,
        subject: dto.subject,
        title: dto.title,
        description: dto.description ?? null,
        dueDate: dto.dueDate,
        attachmentUrl: dto.attachmentUrl ?? null,
        academicYear: dto.academicYear,
        createdBy: user.id,
        createdByName: user.name,
      },
    });
  }

  async updateHomework(user: AuthUser, id: string, dto: Partial<{
    title: string; description: string; dueDate: string;
    attachmentUrl: string; subject: string; grade: number; gradeTo: number;
  }>) {
    const hw = await prisma.homework.findUnique({ where: { id } });
    if (!hw) throw new NotFoundException('Homework not found');
    await resolveWritableSchool(user, hw.schoolId);
    return prisma.homework.update({ where: { id }, data: dto });
  }

  async deleteHomework(user: AuthUser, id: string) {
    const hw = await prisma.homework.findUnique({ where: { id } });
    if (!hw) throw new NotFoundException('Homework not found');
    await resolveWritableSchool(user, hw.schoolId);
    return prisma.homework.delete({ where: { id } });
  }

  async listSubmissions(homeworkId: string) {
    return prisma.homeworkSubmission.findMany({
      where: { homeworkId },
      orderBy: { submittedAt: 'asc' },
    });
  }

  async submitHomework(homeworkId: string, dto: {
    studentId: string; studentName: string; note?: string; fileUrl?: string;
  }) {
    return prisma.homeworkSubmission.upsert({
      where: { homeworkId_studentId: { homeworkId, studentId: dto.studentId } },
      create: { homeworkId, ...dto },
      update: { note: dto.note, fileUrl: dto.fileUrl, submittedAt: new Date() },
    });
  }

  async markSubmission(submissionId: string) {
    return prisma.homeworkSubmission.update({
      where: { id: submissionId },
      data: { markedDone: true },
    });
  }

  // ── Syllabus / Chapter Progress ────────────────────────────────────────────

  async listSyllabus(user: AuthUser, params: {
    schoolId?: string; grade: number; subject: string; academicYear: string;
  }) {
    const { schoolId: userSchoolId } = schoolScope(user);
    const sid = userSchoolId ?? params.schoolId;
    return prisma.syllabusChapter.findMany({
      where: {
        ...(sid ? { schoolId: sid } : {}),
        grade: params.grade,
        subject: params.subject,
        academicYear: params.academicYear,
      },
      include: { progress: true },
      orderBy: { chapterNo: 'asc' },
    });
  }

  async addChapter(user: AuthUser, dto: {
    schoolId?: string; subject: string; grade: number;
    academicYear: string; chapterNo: number; title: string; totalTopics: number;
  }) {
    const sid = await resolveWritableSchool(user, dto.schoolId);
    return prisma.syllabusChapter.create({
      data: { ...dto, schoolId: sid },
    });
  }

  async updateChapterProgress(user: AuthUser, chapterId: string, dto: {
    completedTopics: number; status: string;
  }) {
    const chapter = await prisma.syllabusChapter.findUnique({ where: { id: chapterId } });
    if (!chapter) throw new NotFoundException('Chapter not found');
    await resolveWritableSchool(user, chapter.schoolId);
    return prisma.chapterProgress.upsert({
      where: { chapterId },
      create: { chapterId, ...dto, updatedBy: user.id },
      update: { ...dto, updatedBy: user.id, updatedAt: new Date() },
    });
  }

  async deleteChapter(user: AuthUser, id: string) {
    const chapter = await prisma.syllabusChapter.findUnique({ where: { id } });
    if (!chapter) throw new NotFoundException('Chapter not found');
    await resolveWritableSchool(user, chapter.schoolId);
    return prisma.syllabusChapter.delete({ where: { id } });
  }
}
