import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const LEVEL_MAP: Record<number, string> = {
  1: "A1",
  2: "A1",
  3: "A2",
  4: "A2",
  5: "B1",
  6: "B1",
  7: "B2",
  8: "B2",
  9: "C1",
};

const clampDifficulty = (value: number) => Math.min(9, Math.max(1, value));

export const difficultyToCefrLevel = (difficulty: number) => {
  const level = LEVEL_MAP[clampDifficulty(Math.round(difficulty))];
  return level ?? "A1";
};

export type AIQuestion = {
  question: string;
  options: string[];
  correctAnswer: string;
  skillTag: "vocab" | "grammar";
};

export async function generateQuestion(
  difficulty: number
): Promise<AIQuestion> {
  const level = difficultyToCefrLevel(difficulty);

  const prompt = `
Generate ONE English multiple-choice question.
CEFR level: ${level}.
Constraints:
- Four options, clear strings (not "A/B/C/D"), no duplicates.
- "correctAnswer" must be EXACTLY one of the strings in "options".
- skillTag: "vocab" or "grammar".
Return STRICT JSON (no markdown, no text):
{
  "question": "...",
  "options": ["...","...","...","..."],
  "correctAnswer": "...",
  "skillTag": "vocab"
}
`;

  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });

    const content = res.choices[0]?.message?.content;
    if (!content) throw new Error("AI empty");

    const parsed = JSON.parse(content) as AIQuestion;
    // Normalize / validate
    const options = Array.isArray(parsed.options)
      ? parsed.options.map((o) => String(o).trim()).filter(Boolean)
      : [];
    const question = (parsed.question ?? "").toString().trim();
    const skillTag: AIQuestion["skillTag"] =
      parsed.skillTag === "grammar" ? "grammar" : "vocab";
    let correctAnswer = (parsed.correctAnswer ?? "").toString().trim();
    if (!options.includes(correctAnswer)) {
      correctAnswer = options[0] ?? "";
    }
    if (!question || options.length < 2 || !correctAnswer) {
      throw new Error("AI invalid payload");
    }
    return { question, options, correctAnswer, skillTag };
  } catch (err) {
    // Fallback to static pool when AI is unavailable
    return fallbackQuestion(level);
  }
}

// ---------- Fallback pool (no AI) ----------
type BankItem = AIQuestion & { level: string };

const FALLBACK_BANK: BankItem[] = [
  {
    level: "A1",
    skillTag: "vocab",
    question: "What does 'apple' mean?",
    options: ["Một loại trái cây", "Một con vật", "Một cái bàn", "Một màu sắc"],
    correctAnswer: "Một loại trái cây",
  },
  {
    level: "A1",
    skillTag: "grammar",
    question: "Choose the correct form: 'She ___ a student.'",
    options: ["am", "is", "are", "be"],
    correctAnswer: "is",
  },
  {
    level: "A2",
    skillTag: "vocab",
    question: "What does 'library' mean?",
    options: ["Thư viện", "Phòng ngủ", "Bệnh viện", "Rạp phim"],
    correctAnswer: "Thư viện",
  },
  {
    level: "A2",
    skillTag: "grammar",
    question: "Choose the past tense: 'They ___ soccer yesterday.'",
    options: ["plays", "played", "play", "playing"],
    correctAnswer: "played",
  },
  {
    level: "B1",
    skillTag: "vocab",
    question: "What does 'efficient' mean?",
    options: ["Hiệu quả", "Nổi bật", "Nhàm chán", "Khó khăn"],
    correctAnswer: "Hiệu quả",
  },
  {
    level: "B1",
    skillTag: "grammar",
    question: "Choose the correct conditional: 'If I ___ time, I will call you.'",
    options: ["have", "had", "has", "having"],
    correctAnswer: "have",
  },
  {
    level: "B2",
    skillTag: "vocab",
    question: "What does 'reliable' mean?",
    options: ["Đáng tin cậy", "Dễ vỡ", "Bừa bộn", "Nổi tiếng"],
    correctAnswer: "Đáng tin cậy",
  },
  {
    level: "B2",
    skillTag: "grammar",
    question: "Choose the correct passive: 'The report ___ by the manager.'",
    options: ["was written", "wrote", "is write", "has write"],
    correctAnswer: "was written",
  },
  {
    level: "C1",
    skillTag: "vocab",
    question: "What does 'meticulous' mean?",
    options: ["Tỉ mỉ", "Nhanh chóng", "Nông cạn", "Thô lỗ"],
    correctAnswer: "Tỉ mỉ",
  },
  {
    level: "C1",
    skillTag: "grammar",
    question: "Choose the correct inversion: '___ had I arrived than it started to rain.'",
    options: ["No sooner", "Hardly", "Rarely", "Seldom"],
    correctAnswer: "No sooner",
  },
  {
    level: "B1",
    skillTag: "vocab",
    question: "What does 'adaptable' mean?",
    options: ["Thích nghi tốt", "Cứng nhắc", "Chậm chạp", "Dễ vỡ"],
    correctAnswer: "Thích nghi tốt",
  },
  {
    level: "A2",
    skillTag: "grammar",
    question: "Fill in: 'I have lived here ___ 2010.'",
    options: ["since", "for", "from", "in"],
    correctAnswer: "since",
  },
];

function fallbackQuestion(level: string): AIQuestion {
  const pool = FALLBACK_BANK.filter((q) => q.level === level);
  const source = pool.length ? pool : FALLBACK_BANK;
  const pick =
    source[Math.floor(Math.random() * source.length)] ??
    source[0] ??
    FALLBACK_BANK[0];
  if (!pick) {
    throw new Error("Fallback question bank is empty");
  }
  const options = shuffle(pick.options);
  return {
    question: pick.question,
    options,
    correctAnswer: pick.correctAnswer,
    skillTag: pick.skillTag,
  };
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}
