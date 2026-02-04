export type DraftQuestion = {
  question: string;
  choices: string[]; // ideally 4
  needsReview: boolean;
  detectedCorrect?: number; // 0..3
};

function normalizeLine(s: string) {
  return s.replace(/\u00a0/g, " ").trim();
}

const choiceRegexes: RegExp[] = [
  /^\(?[A-Da-d]\)?[.)\-:]\s*(.+)$/u, // A) ... A. ... A- ... A: ...
  /^[•\-]\s*\(?[A-Da-d]\)?[.)\-:]\s*(.+)$/u, // - A) ...
];

const answerRegex = /^(?:ans|answer)\s*[:\-]\s*([A-Da-d])\s*$/iu;

/**
 * Parse pasted MCQ text into draft questions.
 * يدعم أكثر من شكل شائع (A./A)/a- / Q1: ...)
 * لو السؤال ناقص اختيارات أو شكله غريب -> needsReview = true.
 */
export function parseMcqText(raw: string): DraftQuestion[] {
  const lines = raw
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter((l) => l.length > 0);

  const out: DraftQuestion[] = [];

  let currentQ: string[] = [];
  let currentChoices: string[] = [];
  let detectedCorrect: number | undefined;

  const flush = () => {
    if (currentQ.length === 0 && currentChoices.length === 0) return;

    const qText = currentQ.join(" ").trim();
    const needsReview =
      !qText ||
      currentChoices.length < 2 ||
      currentChoices.length > 6 ||
      currentChoices.length !== 4;

    out.push({
      question: qText || "(بدون نص سؤال)",
      choices: currentChoices.slice(0, 6),
      needsReview,
      detectedCorrect,
    });

    currentQ = [];
    currentChoices = [];
    detectedCorrect = undefined;
  };

  for (const line of lines) {
    // New question header (e.g., 1) / 1. / Q1:)
    const isNewHeader =
      /^\s*(?:Q\s*)?\d+\s*[).:\-]\s+/iu.test(line) &&
      (currentQ.length > 0 || currentChoices.length > 0);

    if (isNewHeader) flush();

    // Answer: B
    const ansMatch = line.match(answerRegex);
    if (ansMatch) {
      const letter = ansMatch[1].toUpperCase();
      detectedCorrect = "ABCD".indexOf(letter);
      continue;
    }

    // (A) .. (B) .. (C) .. (D) .. in one line
    if (/\(A\).*(\(B\)).*(\(C\)).*(\(D\))/iu.test(line)) {
      const parts = line
        .split(/\(\s*[A-D]\s*\)\s*/iu)
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.length >= 5) {
        if (currentQ.length === 0) currentQ.push(parts[0]);
        currentChoices.push(...parts.slice(1, 5));
        continue;
      }
    }

    // Choice line
    let choiceText: string | null = null;
    for (const rx of choiceRegexes) {
      const m = line.match(rx);
      if (m) {
        choiceText = (m[1] ?? "").trim();
        break;
      }
    }

    if (choiceText !== null) {
      currentChoices.push(choiceText);
      continue;
    }

    // Otherwise: question text or continuation of last choice
    if (currentChoices.length === 0) {
      currentQ.push(line);
    } else {
      currentChoices[currentChoices.length - 1] =
        `${currentChoices[currentChoices.length - 1]} ${line}`.trim();
    }
  }

  flush();

  return out.filter((q) => q.question !== "(بدون نص سؤال)" || q.choices.length > 0);
}

export function letterFromIndex(i: number) {
  return ["A", "B", "C", "D", "E", "F"][i] ?? "?";
}
