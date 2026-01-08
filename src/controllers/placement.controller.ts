import { Response } from "express";
import prisma from "../utils/prisma";
import { AuthRequest } from "../middleware/auth.middleware";
import { difficultyToCefrLevel, generateQuestion } from "../services/placement.ai";

const TOTAL_QUESTIONS = 30;

export const startPlacement = async (
  req: AuthRequest,
  res: Response
) => {
  const assessment = await prisma.assessment.create({
    data: {
      userId: req.userId!,
      totalQuestions: TOTAL_QUESTIONS,
    },
  });

  res.json({ assessmentId: assessment.id });
};

export const nextQuestion = async (
  req: AuthRequest,
  res: Response
) => {
  const { assessmentId, answer } = req.body as {
    assessmentId?: string;
    answer?: string;
  };

  if (!assessmentId) {
    return res.status(400).json({ message: "assessmentId is required" });
  }

  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: { items: { select: { id: true } } },
  });

  if (!assessment || assessment.userId !== req.userId) {
    return res.status(404).json({ message: "Assessment not found" });
  }

  let answered = await prisma.assessmentItem.count({
    where: { assessmentId, userAnswer: { not: null } },
  });

  let last = await prisma.assessmentItem.findFirst({
    where: { assessmentId },
    orderBy: { id: "desc" },
  });

  // If user calls without providing an answer and the latest item is still unanswered,
  // return that item instead of creating a duplicate question.
  if (!answer && last && last.userAnswer === null) {
    return res.json({
      itemId: last.id,
      question: last.question,
      options: last.options as string[],
      progress: answered + 1,
      total: TOTAL_QUESTIONS,
    });
  }

  if (answer) {
    if (!last || last.userAnswer !== null) {
      return res.status(400).json({ message: "No pending question to answer" });
    }

    last = await prisma.assessmentItem.update({
      where: { id: last.id },
      data: {
        userAnswer: answer,
        isCorrect: answer === last.correctAnswer,
      },
    });

    answered += 1;
  }

  if (answered >= TOTAL_QUESTIONS) {
    const items = await prisma.assessmentItem.findMany({
      where: { assessmentId },
      select: { isCorrect: true, difficulty: true },
    });

    const correct = items.filter((i) => i.isCorrect).length;
    const finalScore = items.length
      ? Math.round((correct / items.length) * 100)
      : 0;

    const avgDifficulty =
      items.reduce((sum, i) => sum + i.difficulty, 0) /
        (items.length || 1);

    const finalLevel = difficultyToCefrLevel(avgDifficulty);

    await prisma.assessment.update({
      where: { id: assessmentId },
      data: { finalScore, finalLevel },
    });

    return res.json({
      done: true,
      finalScore,
      finalLevel,
    });
  }

  let difficulty = last ? last.difficulty : 5;

  if (last && typeof last.isCorrect === "boolean") {
    difficulty += last.isCorrect ? 1 : -1;
    difficulty = Math.min(9, Math.max(1, difficulty));
  }

  const q = await generateQuestion(difficulty);

  const item = await prisma.assessmentItem.create({
    data: {
      assessmentId,
      question: q.question,
      options: q.options as unknown as any,
      correctAnswer: q.correctAnswer,
      difficulty,
      skillTag: q.skillTag,
    },
  });

  res.json({
    itemId: item.id,
    question: item.question,
    options: item.options as string[],
    progress: answered + 1,
    total: TOTAL_QUESTIONS,
  });
};
