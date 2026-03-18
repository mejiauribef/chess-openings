import type { ReviewState } from '@/domain/training';

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function createInitialReviewState(cardId: string, now = new Date()): ReviewState {
  return {
    cardId,
    dueAt: now.toISOString(),
    stability: 1,
    difficulty: 5,
    lapses: 0,
    successes: 0,
    lastGrade: 0,
    streak: 0,
  };
}

export function isReviewDue(reviewState: ReviewState | undefined, now = new Date()): boolean {
  if (!reviewState) {
    return true;
  }

  return new Date(reviewState.dueAt).getTime() <= now.getTime();
}

export function rescheduleReview(
  current: ReviewState | undefined,
  cardId: string,
  grade: 0 | 1 | 2 | 3 | 4,
  now = new Date(),
): ReviewState {
  const base: ReviewState = current ?? createInitialReviewState(cardId, now);

  if (grade <= 1) {
    const nextDue = new Date(now.getTime() + 10 * 60 * 1000);

    return {
      ...base,
      dueAt: nextDue.toISOString(),
      stability: 1,
      difficulty: clamp(base.difficulty + 1, 1, 10),
      lapses: base.lapses + 1,
      lastGrade: grade,
      streak: 0,
    };
  }

  if (grade === 2) {
    const nextDue = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    return {
      ...base,
      dueAt: nextDue.toISOString(),
      stability: 1,
      difficulty: clamp(base.difficulty, 1, 10),
      lastGrade: grade,
      streak: 0,
    };
  }

  const boost = grade === 4 ? 2.5 : 1.5;
  const nextStability = clamp(base.stability * boost + grade, 1, 365);
  const nextDue = new Date(now.getTime() + nextStability * 24 * 60 * 60 * 1000);

  return {
    ...base,
    dueAt: nextDue.toISOString(),
    stability: nextStability,
    difficulty: clamp(base.difficulty - 1, 1, 10),
    successes: base.successes + 1,
    lastGrade: grade,
    streak: base.streak + 1,
  };
}
