// 评估指标服务 —— 回答质量评分、检索准确率评估

export interface QualityScore {
  overall: number;
  relevance: number;
  coherence: number;
  completeness: number;
  conciseness: number;
}

export interface RetrievalMetric {
  query: string;
  retrieved: string[];
  relevant: string[];
  precision: number;
  recall: number;
  f1: number;
  mrr: number;
}

export interface EvaluationStats {
  totalEvaluations: number;
  avgQualityScore: number;
  avgRetrievalPrecision: number;
  avgRetrievalRecall: number;
  avgRetrievalF1: number;
  recentEvaluations: Array<{
    id: string;
    type: "quality" | "retrieval";
    score: number;
    timestamp: number;
  }>;
}

interface EvaluationRecord {
  id: string;
  type: "quality" | "retrieval";
  data: QualityScore | RetrievalMetric;
  timestamp: number;
}

const MAX_EVALUATIONS = 500;
const evaluations: EvaluationRecord[] = [];

function generateId(): string {
  return `eval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function keywordOverlap(query: string, answer: string): number {
  const qWords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 1);
  const aWords = answer
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 1);
  if (qWords.length === 0) return 0.5;
  const matches = qWords.filter((w) => aWords.includes(w)).length;
  return Math.min(1, matches / qWords.length);
}

function calcCoherence(text: string): number {
  if (text.length < 20) return 0.5;
  const sentences = text.split(/[。！？.!?]/).filter((s) => s.trim().length > 0);
  if (sentences.length < 2) return 0.6;
  return Math.min(1, 0.5 + sentences.length * 0.05);
}

function calcCompleteness(text: string, minLength: number = 100): number {
  if (text.length >= minLength * 2) return 1.0;
  if (text.length >= minLength) return 0.7 + ((text.length - minLength) / minLength) * 0.3;
  return Math.max(0.2, (text.length / minLength) * 0.7);
}

function calcConciseness(text: string, idealLength: number = 500): number {
  const ratio = text.length / idealLength;
  if (ratio <= 1) return 0.5 + ratio * 0.5;
  if (ratio <= 2) return 1.0 - (ratio - 1) * 0.3;
  return Math.max(0.3, 0.7 - (ratio - 2) * 0.2);
}

export function evaluateAnswerQuality(question: string, answer: string): QualityScore {
  const relevance = 0.4 + keywordOverlap(question, answer) * 0.6;
  const coherence = calcCoherence(answer);
  const completeness = calcCompleteness(answer);
  const conciseness = calcConciseness(answer);

  const overall = relevance * 0.35 + coherence * 0.25 + completeness * 0.25 + conciseness * 0.15;

  const score: QualityScore = {
    overall: Math.round(overall * 100) / 100,
    relevance: Math.round(relevance * 100) / 100,
    coherence: Math.round(coherence * 100) / 100,
    completeness: Math.round(completeness * 100) / 100,
    conciseness: Math.round(conciseness * 100) / 100,
  };

  evaluations.push({
    id: generateId(),
    type: "quality",
    data: score,
    timestamp: Date.now(),
  });

  if (evaluations.length > MAX_EVALUATIONS) {
    evaluations.shift();
  }

  return score;
}

export function evaluateRetrieval(
  query: string,
  retrievedDocs: string[],
  relevantDocIds: string[],
): RetrievalMetric {
  const retrievedLower = retrievedDocs.map((d) => d.toLowerCase());
  const relevantLower = relevantDocIds.map((d) => d.toLowerCase());

  const relevantRetrieved = retrievedLower.filter((d) => relevantLower.includes(d));

  const precision = retrievedDocs.length > 0 ? relevantRetrieved.length / retrievedDocs.length : 0;
  const recall = relevantDocIds.length > 0 ? relevantRetrieved.length / relevantDocIds.length : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

  let mrr = 0;
  for (let i = 0; i < retrievedLower.length; i++) {
    if (relevantLower.includes(retrievedLower[i])) {
      mrr = 1 / (i + 1);
      break;
    }
  }

  const metric: RetrievalMetric = {
    query,
    retrieved: retrievedDocs,
    relevant: relevantDocIds,
    precision: Math.round(precision * 100) / 100,
    recall: Math.round(recall * 100) / 100,
    f1: Math.round(f1 * 100) / 100,
    mrr: Math.round(mrr * 100) / 100,
  };

  evaluations.push({
    id: generateId(),
    type: "retrieval",
    data: metric,
    timestamp: Date.now(),
  });

  if (evaluations.length > MAX_EVALUATIONS) {
    evaluations.shift();
  }

  return metric;
}

export function getEvaluationStats(): EvaluationStats {
  const qualityEvals = evaluations.filter((e) => e.type === "quality") as Array<
    { data: QualityScore } & EvaluationRecord
  >;
  const retrievalEvals = evaluations.filter((e) => e.type === "retrieval") as Array<
    { data: RetrievalMetric } & EvaluationRecord
  >;

  const avgQuality =
    qualityEvals.length > 0
      ? qualityEvals.reduce((sum, e) => sum + (e.data as QualityScore).overall, 0) /
        qualityEvals.length
      : 0;

  const avgPrecision =
    retrievalEvals.length > 0
      ? retrievalEvals.reduce((sum, e) => sum + (e.data as RetrievalMetric).precision, 0) /
        retrievalEvals.length
      : 0;

  const avgRecall =
    retrievalEvals.length > 0
      ? retrievalEvals.reduce((sum, e) => sum + (e.data as RetrievalMetric).recall, 0) /
        retrievalEvals.length
      : 0;

  const avgF1 =
    retrievalEvals.length > 0
      ? retrievalEvals.reduce((sum, e) => sum + (e.data as RetrievalMetric).f1, 0) /
        retrievalEvals.length
      : 0;

  const recent = [...evaluations]
    .reverse()
    .slice(0, 20)
    .map((e) => ({
      id: e.id,
      type: e.type,
      score:
        e.type === "quality" ? (e.data as QualityScore).overall : (e.data as RetrievalMetric).f1,
      timestamp: e.timestamp,
    }));

  return {
    totalEvaluations: evaluations.length,
    avgQualityScore: Math.round(avgQuality * 100) / 100,
    avgRetrievalPrecision: Math.round(avgPrecision * 100) / 100,
    avgRetrievalRecall: Math.round(avgRecall * 100) / 100,
    avgRetrievalF1: Math.round(avgF1 * 100) / 100,
    recentEvaluations: recent,
  };
}

export function clearEvaluations(): void {
  evaluations.length = 0;
}
