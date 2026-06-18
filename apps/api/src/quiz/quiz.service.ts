import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { AuthUser } from '@edubeam/shared';

const prisma = new PrismaClient();

const ACADEMIC_YEAR = '2025-26';

function canManageQuiz(role: string) {
  return ['ADMIN', 'STATE_OFFICIAL', 'DISTRICT_OFFICIAL', 'BLOCK_OFFICIAL', 'PRINCIPAL', 'TEACHER'].includes(role);
}

@Injectable()
export class QuizService {
  // ── Create quiz ─────────────────────────────────────────────────────────
  async create(user: AuthUser, dto: {
    schoolId?: string; title: string; description?: string;
    subject: string; grade: number; section?: string; dueDate?: string;
  }) {
    if (!canManageQuiz(user.role)) throw new ForbiddenException();

    const schoolId = user.schoolId ?? dto.schoolId;
    if (!schoolId) throw new BadRequestException('schoolId required');

    return prisma.quiz.create({
      data: {
        schoolId,
        title: dto.title,
        description: dto.description,
        subject: dto.subject,
        grade: dto.grade,
        section: dto.section,
        dueDate: dto.dueDate,
        academicYear: ACADEMIC_YEAR,
        createdBy: user.id,
        isActive: true,
      },
      include: { questions: { orderBy: { orderNo: 'asc' } } },
    });
  }

  // ── Add / replace questions for a quiz ─────────────────────────────────
  async setQuestions(user: AuthUser, quizId: string, questions: {
    question: string; options: string[]; correct: number; marks?: number; orderNo?: number;
  }[]) {
    if (!canManageQuiz(user.role)) throw new ForbiddenException();
    const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
    if (!quiz) throw new NotFoundException('Quiz not found');

    await prisma.quizQuestion.deleteMany({ where: { quizId } });
    await prisma.quizQuestion.createMany({
      data: questions.map((q, i) => ({
        quizId,
        question: q.question,
        options: JSON.stringify(q.options),
        correct: q.correct,
        marks: q.marks ?? 1,
        orderNo: q.orderNo ?? i,
      })),
    });
    return prisma.quiz.findUnique({
      where: { id: quizId },
      include: { questions: { orderBy: { orderNo: 'asc' } } },
    });
  }

  // ── List quizzes (teacher/admin: all for school; student: active + not yet attempted) ─
  async list(user: AuthUser, params: { schoolId?: string; grade?: number }) {
    let schoolId = user.schoolId ?? params.schoolId;

    if (user.role === 'STUDENT') {
      if (!user.schoolId) throw new ForbiddenException();
      const student = user.studentId
        ? await prisma.student.findUnique({ where: { id: user.studentId }, select: { grade: true } })
        : null;

      const quizzes = await prisma.quiz.findMany({
        where: {
          schoolId: user.schoolId,
          isActive: true,
          ...(student ? { grade: student.grade } : {}),
        },
        include: {
          questions: { select: { id: true }, orderBy: { orderNo: 'asc' } },
          attempts: { where: { studentId: user.studentId ?? '' }, select: { score: true, maxScore: true, completedAt: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      return quizzes.map(q => ({
        ...q,
        questionCount: q.questions.length,
        questions: undefined,
        myAttempt: q.attempts[0] ?? null,
        attempts: undefined,
      }));
    }

    if (!schoolId) throw new BadRequestException('schoolId required');

    const quizzes = await prisma.quiz.findMany({
      where: {
        schoolId,
        ...(params.grade ? { grade: params.grade } : {}),
      },
      include: {
        questions: { select: { id: true } },
        attempts: { select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return quizzes.map(q => ({
      ...q,
      questionCount: q.questions.length,
      questions: undefined,
      attemptCount: q.attempts.length,
      attempts: undefined,
    }));
  }

  // ── Get single quiz with questions (correct answers hidden for students) ─
  async get(user: AuthUser, quizId: string) {
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: { questions: { orderBy: { orderNo: 'asc' } } },
    });
    if (!quiz) throw new NotFoundException('Quiz not found');

    const questions = quiz.questions.map(q => ({
      id: q.id,
      question: q.question,
      options: JSON.parse(q.options) as string[],
      marks: q.marks,
      orderNo: q.orderNo,
      ...(user.role !== 'STUDENT' ? { correct: q.correct } : {}),
    }));

    let myAttempt = null;
    if (user.role === 'STUDENT' && user.studentId) {
      myAttempt = await prisma.studentAttempt.findUnique({
        where: { quizId_studentId: { quizId, studentId: user.studentId } },
      });
    }

    return { ...quiz, questions, myAttempt };
  }

  // ── Submit attempt ──────────────────────────────────────────────────────
  async submitAttempt(user: AuthUser, quizId: string, dto: {
    answers: Record<string, number>; timeTaken?: number;
  }) {
    if (user.role !== 'STUDENT') throw new ForbiddenException('Only students can submit attempts');
    if (!user.studentId) throw new ForbiddenException('No student profile linked to your account');

    const existing = await prisma.studentAttempt.findUnique({
      where: { quizId_studentId: { quizId, studentId: user.studentId } },
    });
    if (existing) throw new BadRequestException('You have already submitted this quiz');

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: { questions: true },
    });
    if (!quiz) throw new NotFoundException('Quiz not found');
    if (!quiz.isActive) throw new BadRequestException('This quiz is no longer active');

    let score = 0;
    let maxScore = 0;
    for (const q of quiz.questions) {
      maxScore += q.marks;
      const selected = dto.answers[q.id];
      if (selected === q.correct) score += q.marks;
    }

    return prisma.studentAttempt.create({
      data: {
        quizId,
        studentId: user.studentId,
        answers: JSON.stringify(dto.answers),
        score,
        maxScore,
        timeTaken: dto.timeTaken,
      },
    });
  }

  // ── Get results for a quiz (teacher/admin view with per-student breakdown) ─
  async results(user: AuthUser, quizId: string) {
    if (!canManageQuiz(user.role)) throw new ForbiddenException();

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: { orderBy: { orderNo: 'asc' } },
        attempts: { orderBy: { score: 'desc' } },
      },
    });
    if (!quiz) throw new NotFoundException('Quiz not found');

    const studentIds = quiz.attempts.map(a => a.studentId);
    const students = studentIds.length
      ? await prisma.student.findMany({
          where: { id: { in: studentIds } },
          select: { id: true, name: true, rollNo: true, grade: true, section: true },
        })
      : [];

    const studentMap = Object.fromEntries(students.map(s => [s.id, s]));

    const attempts = quiz.attempts.map(a => ({
      studentId: a.studentId,
      student: studentMap[a.studentId] ?? null,
      score: a.score,
      maxScore: a.maxScore,
      pct: a.maxScore > 0 ? Math.round((a.score / a.maxScore) * 100) : 0,
      timeTaken: a.timeTaken,
      completedAt: a.completedAt,
    }));

    const questions = quiz.questions.map(q => ({
      id: q.id,
      question: q.question,
      options: JSON.parse(q.options) as string[],
      correct: q.correct,
      marks: q.marks,
    }));

    return {
      quiz: { ...quiz, questions: undefined, attempts: undefined },
      questions,
      attempts,
      totalAttempts: attempts.length,
      avgScore: attempts.length
        ? Math.round(attempts.reduce((s, a) => s + a.pct, 0) / attempts.length)
        : null,
    };
  }

  // ── Toggle active / archive ─────────────────────────────────────────────
  async toggleActive(user: AuthUser, quizId: string) {
    if (!canManageQuiz(user.role)) throw new ForbiddenException();
    const quiz = await prisma.quiz.findUnique({ where: { id: quizId } });
    if (!quiz) throw new NotFoundException();
    return prisma.quiz.update({ where: { id: quizId }, data: { isActive: !quiz.isActive } });
  }

  // ── Delete ──────────────────────────────────────────────────────────────
  async remove(user: AuthUser, quizId: string) {
    if (!canManageQuiz(user.role)) throw new ForbiddenException();
    await prisma.quizQuestion.deleteMany({ where: { quizId } });
    await prisma.studentAttempt.deleteMany({ where: { quizId } });
    await prisma.quiz.delete({ where: { id: quizId } });
    return { ok: true };
  }
}
