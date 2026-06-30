import type { GenerateInput } from './quiz-generator.interface';

// Shared instruction text used by every provider so output quality and shape
// stay consistent regardless of which LLM is active.
export function buildInstruction(input: GenerateInput): string {
  const diff = input.difficulty ?? 'Medium';
  const lang = input.language ?? 'English';
  const sourceNote =
    input.source.kind === 'text'
      ? 'the chapter text provided below'
      : 'the attached pages from a textbook';

  return [
    `You are an expert school teacher creating a multiple-choice quiz for Class ${input.grade} ${input.subject}.`,
    `Generate exactly ${input.numQuestions} multiple-choice questions based ONLY on ${sourceNote}.`,
    `Difficulty: ${diff}. Language: ${lang}.`,
    '',
    'Rules:',
    '- Each question must have exactly 4 options.',
    '- Exactly one option is correct; "correct" is its 0-based index (0-3).',
    '- Questions must be answerable from the source material, factually accurate, and unambiguous.',
    '- Vary the questions across the material; do not repeat or trivially reword.',
    '- Keep option text concise. Do not prefix options with letters like "A)".',
    '- For each question, include a brief "explanation" (1–2 sentences) saying why the correct option is right — written for a student reviewing their answers.',
    '- Do not include headings or any text outside the questions array.',
  ].join('\n');
}

// JSON Schema describing the array of questions. Used by providers that support
// structured/JSON output to guarantee a parseable shape.
export const QUESTIONS_JSON_SCHEMA = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          options: {
            type: 'array',
            items: { type: 'string' },
          },
          correct: { type: 'integer' },
          explanation: { type: 'string' },
        },
        required: ['question', 'options', 'correct'],
        additionalProperties: false,
      },
    },
  },
  required: ['questions'],
  additionalProperties: false,
} as const;
