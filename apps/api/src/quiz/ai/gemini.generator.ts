import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import {
  AiNotConfiguredError,
  type GenerateInput,
  type GeneratedQuestion,
  type QuizGenerator,
} from './quiz-generator.interface';
import { buildInstruction } from './prompt';

const MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';

// Gemini's responseSchema uses its own SchemaType enum rather than raw JSON Schema.
const RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    questions: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          question: { type: SchemaType.STRING },
          options: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          correct: { type: SchemaType.INTEGER },
          explanation: { type: SchemaType.STRING },
        },
        required: ['question', 'options', 'correct'],
      },
    },
  },
  required: ['questions'],
};

export class GeminiQuizGenerator implements QuizGenerator {
  readonly name = 'gemini';
  private readonly client: GoogleGenerativeAI;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new AiNotConfiguredError(
        'AI quiz generation is not configured. Set GEMINI_API_KEY in the API .env.',
      );
    }
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async generate(input: GenerateInput): Promise<GeneratedQuestion[]> {
    const model = this.client.getGenerativeModel({
      model: MODEL,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA as any,
      },
    });

    const parts: any[] = [{ text: buildInstruction(input) }];
    if (input.source.kind === 'text') {
      parts.push({ text: `\n\nChapter text:\n${input.source.data}` });
    } else {
      parts.push({
        inlineData: {
          mimeType: input.source.mediaType ?? 'application/pdf',
          data: input.source.data,
        },
      });
    }

    const result = await model.generateContent(parts);
    const text = result.response.text();
    return parseQuestions(text);
  }
}

// Defensive parse: providers occasionally wrap JSON in prose or code fences.
export function parseQuestions(text: string): GeneratedQuestion[] {
  let raw = text.trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) raw = fence[1].trim();
  if (!raw.startsWith('{') && !raw.startsWith('[')) {
    const start = raw.search(/[[{]/);
    if (start >= 0) raw = raw.slice(start);
  }

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('AI returned malformed output. Please try again.');
  }

  const list: any[] = Array.isArray(parsed) ? parsed : parsed.questions;
  if (!Array.isArray(list)) throw new Error('AI returned no questions.');

  return list
    .map((q) => ({
      question: String(q.question ?? '').trim(),
      options: Array.isArray(q.options) ? q.options.map((o: any) => String(o ?? '').trim()) : [],
      correct: Number.isInteger(q.correct) ? q.correct : 0,
      explanation: q.explanation ? String(q.explanation).trim() : undefined,
    }))
    .filter((q) => q.question && q.options.length >= 2)
    .map((q) => normalizeOptions(q));
}

// Guarantee exactly 4 options and a valid correct index.
function normalizeOptions(q: GeneratedQuestion): GeneratedQuestion {
  const options = [...q.options];
  while (options.length < 4) options.push('');
  if (options.length > 4) options.length = 4;
  const correct = q.correct >= 0 && q.correct < 4 ? q.correct : 0;
  return { question: q.question, options, correct, explanation: q.explanation };
}
