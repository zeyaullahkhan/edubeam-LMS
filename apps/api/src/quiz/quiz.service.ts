import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import type { AuthUser } from '@edubeam/shared';
import { getQuizGenerator } from './ai/quiz-generator.factory';
import { AiNotConfiguredError, type Difficulty, type SourceKind } from './ai/quiz-generator.interface';

const prisma = new PrismaClient();

const ACADEMIC_YEAR = '2025-26';

function canManageQuiz(role: string) {
  return ['ADMIN', 'STATE_OFFICIAL', 'DISTRICT_OFFICIAL', 'BLOCK_OFFICIAL', 'PRINCIPAL', 'TEACHER'].includes(role);
}

// Map raw LLM-provider errors to a short, teacher-friendly message. Full detail
// is logged server-side; the user never sees the raw vendor dump.
function friendlyAiError(e: any): string {
  const msg = String(e?.message ?? e ?? '').toLowerCase();
  const status = e?.status ?? e?.statusCode ?? e?.code;
  if (status === 429 || msg.includes('429') || msg.includes('quota') || msg.includes('rate limit') || msg.includes('too many requests')) {
    return 'AI is over its current usage limit. Please wait a minute and try again, or ask the administrator to check the AI plan/quota.';
  }
  if (status === 401 || status === 403 || msg.includes('api key') || msg.includes('unauthorized') || msg.includes('permission')) {
    return 'The AI provider rejected the request — the API key may be invalid or unauthorized. Please ask the administrator to check it.';
  }
  if (msg.includes('malformed') || msg.includes('no questions')) {
    return 'AI could not produce valid questions from this material. Try clearer pages or paste the text directly.';
  }
  return 'AI generation failed. Please try again in a moment.';
}

@Injectable()
export class QuizService {
  // ── Create quiz ─────────────────────────────────────────────────────────
  async create(user: AuthUser, dto: {
    schoolId?: string; scope?: string; blockId?: string; districtId?: string; tenantId?: string;
    title: string; description?: string;
    subject: string; grade: number; gradeTo?: number; section?: string; dueDate?: string;
  }) {
    if (!canManageQuiz(user.role)) throw new ForbiddenException();

    const scope = dto.scope ?? 'school';

    let schoolId: string | null = null;
    let blockId: string | null = null;
    let districtId: string | null = null;
    let tenantId: string | null = null;

    if (scope === 'school') {
      schoolId = user.schoolId ?? dto.schoolId ?? null;
      if (!schoolId) throw new BadRequestException('schoolId required for school-scoped quiz');
    } else if (scope === 'block') {
      blockId = dto.blockId ?? user.blockId ?? null;
      if (!blockId) throw new BadRequestException('blockId required for block-scoped quiz');
      districtId = dto.districtId ?? user.districtId ?? null;
    } else if (scope === 'district') {
      districtId = dto.districtId ?? user.districtId ?? null;
      if (!districtId) throw new BadRequestException('districtId required for district-scoped quiz');
    } else if (scope === 'all') {
      tenantId = dto.tenantId ?? user.tenantId ?? null;
      if (!tenantId) throw new BadRequestException('Select a state to broadcast to all schools');
    } else {
      throw new BadRequestException('scope must be school | block | district | all');
    }

    return prisma.quiz.create({
      data: {
        schoolId, scope, blockId, districtId, tenantId,
        title: dto.title,
        description: dto.description,
        subject: dto.subject,
        grade: dto.grade,
        gradeTo: dto.gradeTo ?? null,
        section: dto.section,
        dueDate: dto.dueDate,
        academicYear: ACADEMIC_YEAR,
        createdBy: user.id,
        isActive: true,
      },
      include: { questions: { orderBy: { orderNo: 'asc' } } },
    });
  }

  // ── AI: generate draft questions from uploaded pages or pasted text ──────
  async generateQuestions(user: AuthUser, dto: {
    sourceKind: SourceKind; fileBase64?: string; mediaType?: string; text?: string;
    subject: string; grade: number; numQuestions: number; totalMarks: number;
    difficulty?: Difficulty; language?: string;
  }) {
    if (!canManageQuiz(user.role)) throw new ForbiddenException();

    const numQuestions = Math.floor(Number(dto.numQuestions));
    const totalMarks = Number(dto.totalMarks);
    if (!Number.isFinite(numQuestions) || numQuestions < 1 || numQuestions > 30) {
      throw new BadRequestException('Number of questions must be between 1 and 30');
    }
    if (!Number.isFinite(totalMarks) || totalMarks < numQuestions) {
      throw new BadRequestException('Total marks must be at least the number of questions');
    }
    if (!dto.subject || !dto.grade) throw new BadRequestException('Subject and class are required');

    let source;
    if (dto.sourceKind === 'text') {
      const text = (dto.text ?? '').trim();
      if (text.length < 20) throw new BadRequestException('Paste at least a short paragraph of text');
      source = { kind: 'text' as const, data: text };
    } else if (dto.sourceKind === 'pdf' || dto.sourceKind === 'image') {
      if (!dto.fileBase64) throw new BadRequestException('No file provided');
      source = { kind: dto.sourceKind, data: dto.fileBase64, mediaType: dto.mediaType };
    } else {
      throw new BadRequestException('sourceKind must be pdf | image | text');
    }

    const generator = getQuizGenerator();
    if (!generator) {
      throw new BadRequestException(
        'AI quiz generation is not configured. Ask the administrator to set the AI provider key.',
      );
    }

    let questions;
    try {
      questions = await generator.generate({
        source,
        subject: dto.subject,
        grade: Number(dto.grade),
        numQuestions,
        difficulty: dto.difficulty,
        language: dto.language,
      });
    } catch (e: any) {
      if (e instanceof AiNotConfiguredError) throw new BadRequestException(e.message);
      // Log the full provider error server-side; show the teacher a clean message.
      console.error('[quiz.generate] provider error:', e?.message ?? e);
      throw new BadRequestException(friendlyAiError(e));
    }

    if (!questions.length) throw new BadRequestException('AI could not generate questions from this material.');

    // Assign marks so they sum to totalMarks exactly: even split + remainder
    // spread across the first questions.
    const n = questions.length;
    const base = Math.floor((totalMarks / n) * 2) / 2; // round down to nearest 0.5
    let remaining = totalMarks - base * n;
    const withMarks = questions.map((q) => {
      let marks = base;
      if (remaining >= 0.5) { marks += 0.5; remaining -= 0.5; }
      return { ...q, marks: marks > 0 ? marks : 1 };
    });

    return { questions: withMarks, provider: generator.name };
  }

  // ── Add / replace questions for a quiz ─────────────────────────────────
  async setQuestions(user: AuthUser, quizId: string, questions: {
    question: string; options: string[]; correct: number; marks?: number; orderNo?: number; explanation?: string;
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
        explanation: q.explanation?.trim() || null,
      })),
    });
    return prisma.quiz.findUnique({
      where: { id: quizId },
      include: { questions: { orderBy: { orderNo: 'asc' } } },
    });
  }

  // ── Build OR conditions to find all quizzes visible to a given school ────
  private async buildSchoolVisibilityFilter(schoolId: string, grade?: number) {
    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { blockId: true, block: { select: { districtId: true, district: { select: { tenantId: true } } } } },
    });
    const blockId = school?.blockId ?? null;
    const districtId = school?.block?.districtId ?? null;
    const tenantId = school?.block?.district?.tenantId ?? null;

    const scopeFilter = {
      OR: [
        { schoolId, scope: 'school' },
        ...(blockId    ? [{ blockId,    scope: 'block'    }] : []),
        ...(districtId ? [{ districtId, scope: 'district' }] : []),
        ...(tenantId   ? [{ tenantId,   scope: 'all'      }] : []),
      ],
    };

    if (!grade) return scopeFilter;

    // Quiz covers grade G when: quiz.grade <= G AND (quiz.gradeTo IS NULL ? quiz.grade = G : quiz.gradeTo >= G)
    return {
      AND: [
        scopeFilter,
        { grade: { lte: grade } },
        { OR: [{ gradeTo: null }, { gradeTo: { gte: grade } }] },
      ],
    };
  }

  // ── Build quiz filter for management roles (without schoolId) ────────────
  private buildManagementFilter(user: AuthUser, params: { tenantId?: string; districtId?: string; blockId?: string; schoolId?: string }) {
    const tenantId = params.tenantId ?? user.tenantId;
    const districtId = params.districtId ?? user.districtId;
    const blockId = params.blockId ?? user.blockId;

    if (!tenantId) return {}; // Platform Admin — all quizzes

    if (user.role === 'BLOCK_OFFICIAL' && blockId) {
      return { OR: [{ blockId }, { districtId }, { tenantId, scope: 'all' }] };
    }
    if (user.role === 'DISTRICT_OFFICIAL' && districtId) {
      return { OR: [{ districtId }, { tenantId, scope: 'all' }] };
    }
    // STATE_OFFICIAL / ADMIN with tenantId
    return { OR: [{ tenantId }, { districtId }, { blockId }].filter(c => Object.values(c)[0]) };
  }

  // ── List quizzes ─────────────────────────────────────────────────────────
  async list(user: AuthUser, params: { schoolId?: string; grade?: number }) {
    const schoolId = user.schoolId ?? params.schoolId;

    if (user.role === 'STUDENT') {
      if (!user.schoolId) throw new ForbiddenException();
      const student = user.studentId
        ? await prisma.student.findUnique({ where: { id: user.studentId }, select: { grade: true } })
        : null;
      const visibilityFilter = await this.buildSchoolVisibilityFilter(user.schoolId, student?.grade);
      const quizzes = await prisma.quiz.findMany({
        where: { ...visibilityFilter, isActive: true },
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

    if (schoolId) {
      const visibilityFilter = await this.buildSchoolVisibilityFilter(schoolId, params.grade);
      const quizzes = await prisma.quiz.findMany({
        where: visibilityFilter,
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

    // Management roles without a specific school — show all quizzes in their scope
    if (!canManageQuiz(user.role)) throw new ForbiddenException();
    const where = this.buildManagementFilter(user, params);
    const quizzes = await prisma.quiz.findMany({
      where,
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

  // ── Aggregate statistics for management dashboard ─────────────────────
  async stats(user: AuthUser, params: { tenantId?: string; districtId?: string; blockId?: string; schoolId?: string }) {
    if (!canManageQuiz(user.role)) throw new ForbiddenException();

    const schoolId = user.schoolId ?? params.schoolId;
    let quizWhere: any;

    if (schoolId) {
      quizWhere = await this.buildSchoolVisibilityFilter(schoolId);
    } else {
      quizWhere = this.buildManagementFilter(user, params);
    }

    const quizzes = await prisma.quiz.findMany({
      where: quizWhere,
      include: {
        questions: { select: { id: true } },
        attempts: { select: { id: true, score: true, maxScore: true, studentId: true } },
      },
    });

    const allAttempts = quizzes.flatMap(q => q.attempts);
    const studentIds = [...new Set(allAttempts.map(a => a.studentId))];

    const students = studentIds.length
      ? await prisma.student.findMany({ where: { id: { in: studentIds } }, select: { id: true, schoolId: true } })
      : [];
    const studentSchoolMap = Object.fromEntries(students.map(s => [s.id, s.schoolId]));

    const schoolsAttempted = new Set(allAttempts.map(a => studentSchoolMap[a.studentId]).filter(Boolean)).size;
    const avgScore = allAttempts.length
      ? Math.round(allAttempts.reduce((s, a) => s + (a.maxScore > 0 ? (a.score / a.maxScore) * 100 : 0), 0) / allAttempts.length)
      : null;

    // Score distribution buckets
    const dist = { high: 0, mid: 0, low: 0 };
    allAttempts.forEach(a => {
      const pct = a.maxScore > 0 ? (a.score / a.maxScore) * 100 : 0;
      if (pct >= 75) dist.high++;
      else if (pct >= 50) dist.mid++;
      else dist.low++;
    });

    // By subject
    const subjectMap: Record<string, { quizzes: number; attempts: number; scoreSum: number }> = {};
    quizzes.forEach(q => {
      if (!subjectMap[q.subject]) subjectMap[q.subject] = { quizzes: 0, attempts: 0, scoreSum: 0 };
      subjectMap[q.subject].quizzes++;
      subjectMap[q.subject].attempts += q.attempts.length;
      subjectMap[q.subject].scoreSum += q.attempts.reduce(
        (s, a) => s + (a.maxScore > 0 ? (a.score / a.maxScore) * 100 : 0), 0,
      );
    });
    const bySubject = Object.entries(subjectMap)
      .map(([subject, d]) => ({
        subject,
        quizzes: d.quizzes,
        attempts: d.attempts,
        avgScore: d.attempts > 0 ? Math.round(d.scoreSum / d.attempts) : 0,
      }))
      .sort((a, b) => b.attempts - a.attempts)
      .slice(0, 8);

    // Top quizzes by attempts
    const topQuizzes = quizzes
      .map(q => ({
        id: q.id,
        title: q.title,
        subject: q.subject,
        grade: q.grade,
        scope: q.scope,
        isActive: q.isActive,
        questionCount: q.questions.length,
        attemptCount: q.attempts.length,
        schoolCount: new Set(q.attempts.map(a => studentSchoolMap[a.studentId]).filter(Boolean)).size,
        avgScore: q.attempts.length
          ? Math.round(q.attempts.reduce((s, a) => s + (a.maxScore > 0 ? (a.score / a.maxScore) * 100 : 0), 0) / q.attempts.length)
          : null,
      }))
      .sort((a, b) => b.attemptCount - a.attemptCount)
      .slice(0, 10);

    return {
      totalQuizzes: quizzes.length,
      activeQuizzes: quizzes.filter(q => q.isActive).length,
      totalAttempts: allAttempts.length,
      uniqueStudents: studentIds.length,
      schoolsAttempted,
      avgScore,
      scoreDist: dist,
      bySubject,
      topQuizzes,
    };
  }

  // ── Get single quiz with questions ───────────────────────────────────────
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

    const quiz = await prisma.quiz.findUnique({ where: { id: quizId }, include: { questions: true } });
    if (!quiz) throw new NotFoundException('Quiz not found');
    if (!quiz.isActive) throw new BadRequestException('This quiz is no longer active');

    let score = 0, maxScore = 0;
    for (const q of quiz.questions) {
      maxScore += q.marks;
      if (dto.answers[q.id] === q.correct) score += q.marks;
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

  // ── Answer review for the logged-in student (only after they submit) ─────
  async myReview(user: AuthUser, quizId: string) {
    if (user.role !== 'STUDENT' || !user.studentId) throw new ForbiddenException();

    const attempt = await prisma.studentAttempt.findUnique({
      where: { quizId_studentId: { quizId, studentId: user.studentId } },
    });
    if (!attempt) throw new BadRequestException('Submit the quiz first to review answers.');

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      include: { questions: { orderBy: { orderNo: 'asc' } } },
    });
    if (!quiz) throw new NotFoundException('Quiz not found');

    let answers: Record<string, number> = {};
    try { answers = JSON.parse(attempt.answers); } catch { /* ignore */ }

    const questions = quiz.questions.map(q => ({
      id: q.id,
      question: q.question,
      options: JSON.parse(q.options) as string[],
      correct: q.correct,
      marks: q.marks,
      explanation: q.explanation ?? null,
      selected: answers[q.id] ?? null,
      isCorrect: answers[q.id] === q.correct,
    }));

    return {
      quiz: { id: quiz.id, title: quiz.title, subject: quiz.subject, grade: quiz.grade },
      questions,
      score: attempt.score,
      maxScore: attempt.maxScore,
      pct: attempt.maxScore > 0 ? Math.round((attempt.score / attempt.maxScore) * 100) : 0,
    };
  }

  // ── Get results for a quiz ───────────────────────────────────────────────
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

    const attempts = quiz.attempts.map(a => {
      let answers: Record<string, number> = {};
      try { answers = JSON.parse(a.answers); } catch { /* ignore malformed */ }
      return {
        studentId: a.studentId,
        student: studentMap[a.studentId] ?? null,
        score: a.score,
        maxScore: a.maxScore,
        pct: a.maxScore > 0 ? Math.round((a.score / a.maxScore) * 100) : 0,
        timeTaken: a.timeTaken,
        completedAt: a.completedAt,
        answers, // questionId → selected option index, for per-student review
      };
    });

    const questions = quiz.questions.map(q => ({
      id: q.id,
      question: q.question,
      options: JSON.parse(q.options) as string[],
      correct: q.correct,
      marks: q.marks,
      explanation: q.explanation ?? null,
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
