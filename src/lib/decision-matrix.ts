import { z } from "zod";

export const criterionKindSchema = z.enum([
  "benefit",
  "cost",
  "risk",
  "effort",
  "evidence",
]);

export const optionScoreSchema = z.object({
  criterionId: z.string().min(1),
  score: z.number().int().min(0).max(100),
  rationale: z.string().min(1).max(180),
});

export const criterionSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().min(2).max(48),
  description: z.string().min(1).max(180),
  weight: z.number().int().min(0).max(100),
  kind: criterionKindSchema,
  hardGate: z.boolean(),
  gateMinimum: z.number().int().min(0).max(100),
});

export const decisionOptionSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().min(2).max(64),
  description: z.string().min(1).max(220),
  scores: z.array(optionScoreSchema).min(1).max(10),
  notes: z.string().min(1).max(220),
});

export const decisionMatrixSchema = z.object({
  title: z.string().min(3).max(90),
  shortContext: z.string().min(1).max(260),
  criteria: z.array(criterionSchema).min(3).max(10),
  options: z.array(decisionOptionSchema).min(2).max(12),
  assumptions: z.array(z.string().min(1).max(160)).min(2).max(6),
  recommendation: z.string().min(1).max(320),
  watchouts: z.array(z.string().min(1).max(160)).min(1).max(5),
});

export type CriterionKind = z.infer<typeof criterionKindSchema>;
export type OptionScore = z.infer<typeof optionScoreSchema>;
export type Criterion = z.infer<typeof criterionSchema>;
export type DecisionOption = z.infer<typeof decisionOptionSchema>;
export type DecisionMatrix = z.infer<typeof decisionMatrixSchema>;

export type RankedOption = {
  option: DecisionOption;
  total: number;
  percent: number;
  hardFailures: Criterion[];
  contributions: CriterionContribution[];
};

export type CriterionContribution = {
  criterionId: string;
  name: string;
  rawScore: number;
  effectiveWeight: number;
  weightedScore: number;
  gateFailed: boolean;
};

export type SensitivityWarning = {
  criterionId?: string;
  label: string;
  detail: string;
  severity: "low" | "medium" | "high";
};

const PERCENT_TOTAL = 100;
const FALLBACK_SCORE = 0;

export function makeId(label: string, fallback = "item") {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);

  return slug || fallback;
}

export function clampScore(value: number) {
  return Math.min(PERCENT_TOTAL, Math.max(0, Math.round(value)));
}

export function clampWeight(value: number) {
  return Math.min(PERCENT_TOTAL, Math.max(0, Math.round(value)));
}

export function getScore(option: DecisionOption, criterionId: string) {
  return (
    option.scores.find((score) => score.criterionId === criterionId)?.score ??
    FALLBACK_SCORE
  );
}

export function getScoreRationale(
  option: DecisionOption,
  criterionId: string,
) {
  return (
    option.scores.find((score) => score.criterionId === criterionId)
      ?.rationale ?? "No rationale recorded."
  );
}

export function setOptionScore(
  option: DecisionOption,
  criterionId: string,
  score: number,
): DecisionOption {
  const nextScore = clampScore(score);
  const found = option.scores.some((item) => item.criterionId === criterionId);

  return {
    ...option,
    scores: found
      ? option.scores.map((item) =>
          item.criterionId === criterionId
            ? { ...item, score: nextScore }
            : item,
        )
      : [
          ...option.scores,
          {
            criterionId,
            score: nextScore,
            rationale: "Manual score.",
          },
        ],
    };
}

function normalizedPercentages(values: number[], targetTotal = PERCENT_TOTAL) {
  if (values.length === 0) return [];

  const safeTargetTotal = Math.max(0, Math.round(targetTotal));
  const safeValues = values.map((value) => Math.max(0, Number.isFinite(value) ? value : 0));
  const total = safeValues.reduce((sum, value) => sum + value, 0);
  const rawShares =
    total > 0
      ? safeValues.map((value) => (value / total) * safeTargetTotal)
      : safeValues.map(() => safeTargetTotal / values.length);
  const floors = rawShares.map(Math.floor);
  let remaining = safeTargetTotal - floors.reduce((sum, value) => sum + value, 0);
  const order = rawShares
    .map((share, index) => ({ index, fraction: share - floors[index] }))
    .sort((left, right) => right.fraction - left.fraction || left.index - right.index);

  for (let index = 0; index < remaining; index += 1) {
    floors[order[index % order.length].index] += 1;
  }

  if (remaining < 0) {
    remaining = Math.abs(remaining);
    for (let index = 0; index < remaining; index += 1) {
      const target = order[order.length - 1 - (index % order.length)].index;
      floors[target] = Math.max(0, floors[target] - 1);
    }
  }

  return floors;
}

export function normalizeWeights(criteria: Criterion[]) {
  const weights = normalizedPercentages(
    criteria.map((criterion) => clampWeight(criterion.weight)),
  );

  return criteria.map((criterion, index) => ({
    ...criterion,
    weight: weights[index] ?? 0,
  }));
}

export function effectiveWeightPercent(criteria: Criterion[], criterionId: string) {
  const weights = normalizedPercentages(
    criteria.map((criterion) => clampWeight(criterion.weight)),
  );
  const index = criteria.findIndex((criterion) => criterion.id === criterionId);
  return index >= 0 ? (weights[index] ?? 0) : 0;
}

export function effectiveWeightTotal(criteria: Criterion[]) {
  return normalizeWeights(criteria).reduce(
    (sum, criterion) => sum + criterion.weight,
    0,
  );
}

function scoreForCriterion(option: DecisionOption, criterionId: string) {
  return clampScore(getScore(option, criterionId));
}

export function scoreOptions(matrix: DecisionMatrix): RankedOption[] {
  const criteria = normalizeWeights(matrix.criteria);

  return matrix.options.map((option) => {
    const contributions = criteria.map((criterion) => {
      const criterionWeight = clampWeight(criterion.weight) / PERCENT_TOTAL;
      const rawScore = scoreForCriterion(option, criterion.id);
      const weightedScore = criterionWeight * rawScore;

      return {
        criterionId: criterion.id,
        name: criterion.name,
        rawScore,
        effectiveWeight: criterion.weight,
        weightedScore,
        gateFailed: criterion.hardGate && rawScore < criterion.gateMinimum,
      };
    });
    const percent = contributions.reduce(
      (sum, contribution) => sum + contribution.weightedScore,
      0,
    );
    const hardFailures = criteria.filter(
      (criterion) =>
        criterion.hardGate &&
        scoreForCriterion(option, criterion.id) < criterion.gateMinimum,
    );

    return {
      option,
      total: percent,
      percent,
      hardFailures,
      contributions,
    };
  });
}

export function rankOptions(matrix: DecisionMatrix) {
  return scoreOptions(matrix)
    .sort((left, right) => {
      if (left.hardFailures.length && !right.hardFailures.length) return 1;
      if (!left.hardFailures.length && right.hardFailures.length) return -1;
      return right.total - left.total;
    });
}

export function sanitizeMatrix(matrix: DecisionMatrix): DecisionMatrix {
  const seenCriteria = new Map<string, number>();
  const criteria = normalizeWeights(
    matrix.criteria.map((criterion, index) => {
      const baseId = makeId(criterion.id || criterion.name, `criterion-${index + 1}`);
      const count = seenCriteria.get(baseId) ?? 0;
      seenCriteria.set(baseId, count + 1);

      return {
        ...criterion,
        id: count ? `${baseId}-${count + 1}` : baseId,
        weight: clampWeight(criterion.weight),
        gateMinimum: clampScore(criterion.gateMinimum),
      };
    }),
  );

  const seenOptions = new Map<string, number>();
  const options = matrix.options.map((option, optionIndex) => {
    const baseId = makeId(option.id || option.name, `option-${optionIndex + 1}`);
    const count = seenOptions.get(baseId) ?? 0;
    seenOptions.set(baseId, count + 1);
    const id = count ? `${baseId}-${count + 1}` : baseId;

    return {
      ...option,
      id,
      scores: criteria.map((criterion) => {
        const existing = option.scores.find(
          (score) =>
            makeId(score.criterionId, "criterion") === criterion.id ||
            score.criterionId === criterion.id,
        );

        return {
          criterionId: criterion.id,
          score: clampScore(existing?.score ?? FALLBACK_SCORE),
          rationale: existing?.rationale || "Initial neutral estimate.",
        };
      }),
    };
  });

  return {
    ...matrix,
    criteria,
    options,
  };
}

function withAdjustedWeight(
  criteria: Criterion[],
  criterionId: string,
  multiplier: number,
) {
  return criteria.map((criterion) =>
    criterion.id === criterionId
      ? {
          ...criterion,
          weight: clampWeight(criterion.weight * multiplier),
        }
      : criterion,
  );
}

export function sensitivityWarnings(matrix: DecisionMatrix): SensitivityWarning[] {
  const ranked = rankOptions(matrix).filter(
    (item) => item.hardFailures.length === 0,
  );
  const [winner, runnerUp] = ranked;
  const warnings: SensitivityWarning[] = [];

  if (!winner || !runnerUp) {
    return warnings;
  }

  const gap = winner.total - runnerUp.total;

  if (gap < 4) {
    warnings.push({
      label: "Near tie",
      detail: `${winner.option.name} leads ${runnerUp.option.name} by ${gap.toFixed(
        1,
      )} weighted points.`,
      severity: "high",
    });
  } else if (gap < 8) {
    warnings.push({
      label: "Close call",
      detail: `${winner.option.name} leads by ${gap.toFixed(
        1,
      )} points. A small score or weight change could matter.`,
      severity: "medium",
    });
  }

  for (const criterion of matrix.criteria) {
    const boosted = rankOptions({
      ...matrix,
      criteria: withAdjustedWeight(matrix.criteria, criterion.id, 1.3),
    })[0];
    const reduced = rankOptions({
      ...matrix,
      criteria: withAdjustedWeight(matrix.criteria, criterion.id, 0.7),
    })[0];

    if (boosted && boosted.option.id !== winner.option.id) {
      warnings.push({
        criterionId: criterion.id,
        label: `${criterion.name} can flip it`,
        detail: `Increasing this weight by 30% changes the leader to ${boosted.option.name}.`,
        severity: "medium",
      });
    }

    if (reduced && reduced.option.id !== winner.option.id) {
      warnings.push({
        criterionId: criterion.id,
        label: `${criterion.name} is load-bearing`,
        detail: `Reducing this weight by 30% changes the leader to ${reduced.option.name}.`,
        severity: "medium",
      });
    }
  }

  return warnings.slice(0, 4);
}

export function optionStrengthLabel(percent: number) {
  if (percent >= 50) return "strong";
  if (percent >= 35) return "good";
  if (percent >= 20) return "mixed";
  return "weak";
}
