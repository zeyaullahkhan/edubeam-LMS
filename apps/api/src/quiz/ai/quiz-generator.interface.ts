// Vendor-agnostic contract for AI quiz generation. The controller/service and
// the frontend never reference a specific LLM provider — only the concrete
// generator implementations (gemini / anthropic) touch a vendor SDK.

export type SourceKind = 'pdf' | 'image' | 'text';
export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export interface GenerateSource {
  kind: SourceKind;
  /** base64 (no data: prefix) for pdf/image; raw text for text */
  data: string;
  /** MIME type for pdf/image, e.g. application/pdf, image/png, image/jpeg */
  mediaType?: string;
}

export interface GenerateInput {
  source: GenerateSource;
  subject: string;
  grade: number;
  numQuestions: number;
  difficulty?: Difficulty;
  language?: string;
}

// The model returns only the question shape; marks are assigned server-side so
// they sum to the requested total exactly (LLMs are unreliable at that).
export interface GeneratedQuestion {
  question: string;
  options: string[]; // exactly 4
  correct: number; // 0-based index into options
  explanation?: string; // 1–2 sentence rationale for the correct answer
}

export interface QuizGenerator {
  /** Human-readable provider id, e.g. "gemini" | "anthropic" */
  readonly name: string;
  generate(input: GenerateInput): Promise<GeneratedQuestion[]>;
}

// Injection token for the active QuizGenerator (bound in QuizModule).
export const QUIZ_GENERATOR = 'QUIZ_GENERATOR';

// Thrown when the selected provider is not configured (missing API key).
export class AiNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiNotConfiguredError';
  }
}
