/**
 * Small, deterministic capture helpers shared by every Quick Capture surface.
 * They deliberately return suggestions, never mutate Tasks or make a merge
 * decision. The caller is responsible for retrieving only authorized Task
 * candidates before asking this classifier for a comparison.
 */

export type CapturePrioritySuggestion = "low" | "medium" | "high" | "urgent";
export type CaptureMatchKind = "likely_duplicate" | "similar" | "related" | "similar_completed";

export interface CaptureIntent {
  title: string;
  originalText?: string;
  organizationId?: string;
  organization?: string;
  projectId?: string;
  currentResponsibilityPrincipalId?: string;
  /** Optional clock for deterministic historical-match tests. */
  now?: string;
}

export interface CaptureTaskCandidate {
  id: string;
  version?: number;
  title: string;
  status: "ready" | "in_progress" | "waiting" | "blocked" | "review" | "done";
  organizationId?: string;
  organization?: string;
  projectId?: string;
  project?: string;
  currentResponsibilityPrincipalId?: string;
  currentResponsibilityName?: string;
  currentStep?: string;
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string;
  archivedAt?: string;
}

export interface CaptureTaskMatch extends CaptureTaskCandidate {
  kind: CaptureMatchKind;
  score: number;
  reason: string;
  /** Context is offered only when the new wording adds useful task content. */
  canAddAsContext?: boolean;
  /** Explicit coreference is the one case where a criterion is also useful. */
  isContinuation?: boolean;
}

const STOP_WORDS = new Set([
  "a", "an", "and", "as", "at", "about", "by", "for", "from", "in", "into", "of", "on", "or", "the", "to", "with",
  "need", "needs", "please", "task", "team", "this", "that", "they", "it", "my", "me", "you", "tomorrow", "today", "next", "also",
  "priority", "urgent", "asap", "important", "critical", "top", "high", "low", "normal", "ready", "immediately",
  "deadline", "plan", "planned", "khayangan",
]);

const ACTION_ALIASES: Record<string, string[]> = {
  update: ["update", "revise", "revision", "amend", "change", "refresh"],
  review: ["review", "check", "approve", "proofread", "inspect"],
  create: ["create", "make", "design", "draft", "prepare", "build", "buat", "bikin"],
  call: ["call", "phone", "contact"],
  confirm: ["confirm", "verify", "validate"],
  send: ["send", "share", "submit"],
  fix: ["fix", "repair", "resolve"],
  complete: ["finish", "complete", "finalize", "finalise"],
  register: ["register", "registering", "activate"],
  replace: ["replace", "swap"],
};

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

function words(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map(word => word.replace(/s$/, ""))
    .filter(word => word.length > 1 && !STOP_WORDS.has(word));
}

function editDistance(left: string, right: string) {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let diagonal = previous[0];
    previous[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const saved = previous[rightIndex];
      previous[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + 1,
        diagonal + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
      diagonal = saved;
    }
  }
  return previous[right.length];
}

function sameWord(left: string, right: string) {
  if (left === right) return true;
  const longest = Math.max(left.length, right.length);
  return longest >= 4 && editDistance(left, right) <= (longest >= 8 ? 2 : 1);
}

function captureAction(value: string) {
  const source = new Set(words(value));
  return Object.entries(ACTION_ALIASES).find(([, aliases]) => aliases.some(alias => source.has(alias)))?.[0];
}

function capturePeriod(value: string) {
  const source = new Set(words(value));
  return MONTHS.find(month => source.has(month) || source.has(month.slice(0, 3)));
}

function objectWords(value: string) {
  const actionTerms = new Set(Object.values(ACTION_ALIASES).flat());
  const period = capturePeriod(value);
  return words(value).filter(word => !actionTerms.has(word) && word !== period && word !== period?.slice(0, 3));
}

function overlap(left: string[], right: string[]) {
  if (!left.length || !right.length) return 0;
  const matched = left.filter(token => right.some(candidate => sameWord(token, candidate))).length;
  return matched / Math.max(left.length, right.length);
}

/** Keep title cleanup modest: preserve the actual action and nouns. */
export function conciseCaptureTitle(value: string) {
  let source = value
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  for (let index = 0; index < 3; index += 1) {
    source = source.replace(/^\s*(?:i\s+need\s+to|need\s+to(?:\s+finish)?|please|can\s+you|could\s+you|tomorrow|today|besok)\b[\s,:-]*/i, "");
  }
  const reviewRequest = source.match(/\b(?:finish\s+)?review\s+(?:the\s+)?request\s+from\s+(.+?)(?:\s+(?:of|for)\s+(?:villa\s+)?khayangan)?\s*$/i);
  if (reviewRequest?.[1]) {
    const entity = reviewRequest[1].trim().replace(/\b(?:the|a|an)\b/gi, " ").replace(/\s+/g, " ");
    if (entity) return `Review ${entity.replace(/\b\w/g, letter => letter.toUpperCase())} request`;
  }
  // Scheduling, priority, and an already-resolved organization belong in
  // structured fields. Leaving them in a title also harms intent matching.
  source = source
    .replace(/(?:\s*[,;:]?\s*)\b(?:top\s+priority|priority|urgent|asap|important|high\s+priority|low\s+priority|do\s+(?:this\s+)?immediately)\b/gi, " ")
    .replace(/\s+\b(?:for|of)\s+(?:villa\s+)?khayangan\b/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*[,;:.]+\s*$/g, "")
    .trim();
  source = source.replace(/\bbestari\s+internet\b/gi, "Bestari Internet");
  return source ? source[0].toUpperCase() + source.slice(1) : source;
}

export function explicitCaptureEstimatedMinutes(value: string) {
  const normalized = value.toLocaleLowerCase();
  const match = normalized.match(/\b(?:about|around|approximately|approx\.?|~)?\s*(\d+(?:\.\d+)?)\s*(minutes?|mins?|min|m|hours?|hrs?|hr|h)\b/);
  if (!match) return undefined;
  const amount = Number(match[1]);
  const minutes = /^h|hour|hr/.test(match[2]) ? Math.round(amount * 60) : Math.round(amount);
  return Number.isInteger(minutes) && minutes >= 1 && minutes <= 10_080 ? minutes : undefined;
}

/** A small whitelist is preferable to a made-up duration. */
export function suggestCaptureEstimatedMinutes(value: string) {
  if (explicitCaptureEstimatedMinutes(value)) return undefined;
  const normalized = value.toLocaleLowerCase();
  if (/\b(?:quick\s+)?(?:call|phone)\b/.test(normalized) && !/\b(?:strategy|plan|proposal|report)\b/.test(normalized)) return 15;
  if (/\b(?:review|proofread)\b/.test(normalized) && /\b(?:request|document|proposal|brief)\b/.test(normalized)) return 30;
  return undefined;
}

export function inferCapturePriority(value: string): { priority: CapturePrioritySuggestion; explicit: boolean } {
  const normalized = value.toLocaleLowerCase();
  if (/\b(?:urgent|asap|critical|top\s+priority|immediately|do\s+(?:this\s+)?immediately)\b/.test(normalized)) return { priority: "urgent", explicit: true };
  if (/\b(?:priority|important|high\s+priority|prioriti[sz]e)\b/.test(normalized)) return { priority: "high", explicit: true };
  if (/\b(?:low\s+priority|no\s+rush|someday|whenever)\b/.test(normalized)) return { priority: "low", explicit: true };
  return { priority: "medium", explicit: false };
}

function isRecentlyCompleted(candidate: CaptureTaskCandidate, now: string | undefined) {
  const completedAt = candidate.completedAt || candidate.updatedAt;
  const completedAtMs = completedAt ? Date.parse(completedAt) : Number.NaN;
  const nowMs = now ? Date.parse(now) : Date.now();
  return Number.isFinite(completedAtMs) && Number.isFinite(nowMs) && completedAtMs <= nowMs && completedAtMs >= nowMs - 14 * 86_400_000;
}

/**
 * Compare already-authorized candidates. Date differences are intentionally
 * only supporting context; explicit periods such as September/October are a
 * strong signal that similar text refers to separate recurring work.
 */
export function findCaptureTaskMatches(intent: CaptureIntent, candidates: CaptureTaskCandidate[]): CaptureTaskMatch[] {
  const source = `${intent.title} ${intent.originalText || ""}`;
  const sourceAction = captureAction(source);
  const sourceObjects = objectWords(source);
  const sourcePeriod = capturePeriod(source);
  const continuationLanguage = /\b(?:also|make\s+sure)\b/i.test(intent.originalText || "");
  const explicitCoreference = /\b(?:they|it|this|that)\b/i.test(intent.originalText || "");
  const activeCandidateCount = candidates.filter(candidate => !candidate.archivedAt && candidate.status !== "done").length;

  return candidates
    .filter(candidate => !candidate.archivedAt)
    .flatMap(candidate => {
      const candidateAction = captureAction(`${candidate.title} ${candidate.currentStep || ""}`);
      const candidatePeriod = capturePeriod(`${candidate.title} ${candidate.currentStep || ""}`);
      if (sourcePeriod && candidatePeriod && sourcePeriod !== candidatePeriod) return [];
      const objectScore = overlap(sourceObjects, objectWords(`${candidate.title} ${candidate.currentStep || ""}`));
      const actionMatches = Boolean(sourceAction && candidateAction && sourceAction === candidateAction);
      const organizationMatches = Boolean(intent.organizationId && candidate.organizationId && intent.organizationId === candidate.organizationId)
        || Boolean(!intent.organizationId && intent.organization && candidate.organization && intent.organization === candidate.organization);
      const projectMatches = Boolean(intent.projectId && candidate.projectId && intent.projectId === candidate.projectId);
      const responsibilityMatches = Boolean(intent.currentResponsibilityPrincipalId && candidate.currentResponsibilityPrincipalId === intent.currentResponsibilityPrincipalId);
      // Intent is action + subject. Context may make a strong match more
      // useful, but cannot turn unrelated work into a duplicate.
      const score = Math.min(1, objectScore * 0.72 + (actionMatches ? 0.22 : 0) + (organizationMatches ? 0.03 : 0) + (projectMatches ? 0.02 : 0) + (responsibilityMatches ? 0.01 : 0));
      const active = candidate.status !== "done";
      let kind: CaptureMatchKind | undefined;
      const hasCoreIntentOverlap = Boolean(sourceAction && candidateAction && sourceObjects.length && objectScore >= 0.5);
      const isContinuation = active && continuationLanguage && explicitCoreference && organizationMatches && responsibilityMatches && activeCandidateCount === 1;
      if (active && actionMatches && hasCoreIntentOverlap && score >= 0.58) kind = "likely_duplicate";
      else if (active && !actionMatches && sourceObjects.length > 0 && objectScore >= 0.5) kind = "related";
      else if (isContinuation) kind = "related";
      else if (!active && actionMatches && hasCoreIntentOverlap && objectScore >= 0.8 && isRecentlyCompleted(candidate, intent.now)) kind = "similar_completed";
      if (!kind) return [];
      const candidateObjects = objectWords(`${candidate.title} ${candidate.currentStep || ""}`);
      const hasAdditionalContext = sourceObjects.some(token => !candidateObjects.some(candidateToken => sameWord(token, candidateToken)));
      const signals = [
        actionMatches ? "same action" : objectScore >= 0.5 ? "same subject" : "similar wording",
        organizationMatches ? "same organization" : undefined,
        responsibilityMatches ? "same responsibility" : undefined,
      ].filter(Boolean).join(", ");
      return [{ ...candidate, kind, score, reason: isContinuation ? "explicit continuation" : signals, canAddAsContext: (kind === "likely_duplicate" && hasAdditionalContext) || isContinuation, isContinuation }];
    })
    .sort((left, right) => right.score - left.score || (right.updatedAt || "").localeCompare(left.updatedAt || ""))
    .slice(0, 3);
}

export function captureSearchTerms(value: string) {
  return Array.from(new Set(words(value).filter(word => word.length >= 3))).slice(0, 6);
}

/** Separate independent verbs in one thought without splitting a joint Team. */
export function splitCaptureActionClauses(value: string) {
  return value
    .split(/\n|;|\s+(?:and|then|also)\s+(?=(?:ask|call|contact|send|review|update|create|prepare|check|confirm|fix|draft|design|make)\b)/i)
    .map(clause => clause.trim())
    .filter(Boolean)
    .slice(0, 6);
}
