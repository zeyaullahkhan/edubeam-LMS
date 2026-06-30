import Anthropic from '@anthropic-ai/sdk';
import {
  AiNotConfiguredError,
  type GenerateInput,
  type GeneratedQuestion,
  type QuizGenerator,
} from './quiz-generator.interface';
import { buildInstruction } from './prompt';

// Sonnet for routine material; Opus only when the teacher marks it Hard.
const MODEL_DEFAULT = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6';
const MODEL_HARD = process.env.ANTHROPIC_MODEL_HARD ?? 'claude-opus-4-8';

// Forced tool-use is the most version-stable way to get structured JSON back.
const EMIT_TOOL = {
  name: 'emit_questions',
  description: 'Return the generated multiple-choice questions.',
  input_schema: {
    type: 'object' as const,
    properties: {
      questions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            question: { type: 'string' },
            options: { type: 'array', items: { type: 'string' } },
            correct: { type: 'integer' },
            explanation: { type: 'string' },
          },
          required: ['question', 'options', 'correct'],
        },
      },
    },
    required: ['questions'],
  },
};

export class AnthropicQuizGenerator implements QuizGenerator {
  readonly name = 'anthropic';
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new AiNotConfiguredError(
        'AI quiz generation is not configured. Set ANTHROPIC_API_KEY in the API .env.',
      );
    }
    this.client = new Anthropic({ apiKey });
  }

  async generate(input: GenerateInput): Promise<GeneratedQuestion[]> {
    const model = input.difficulty === 'Hard' ? MODEL_HARD : MODEL_DEFAULT;

    const content: any[] = [{ type: 'text', text: buildInstruction(input) }];
    if (input.source.kind === 'text') {
      content.push({ type: 'text', text: `\n\nChapter text:\n${input.source.data}` });
    } else if (input.source.kind === 'pdf') {
      content.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: input.source.data },
      });
    } else {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: (input.source.mediaType ?? 'image/png') as any,
          data: input.source.data,
        },
      });
    }

    const res = await this.client.messages.create({
      model,
      max_tokens: 8000,
      tools: [EMIT_TOOL as any],
      tool_choice: { type: 'tool', name: 'emit_questions' },
      messages: [{ role: 'user', content }],
    });

    const toolUse = res.content.find((b) => b.type === 'tool_use') as
      | { input: { questions?: any[] } }
      | undefined;
    const list = toolUse?.input?.questions;
    if (!Array.isArray(list)) throw new Error('AI returned no questions.');

    return list
      .map((q) => ({
        question: String(q.question ?? '').trim(),
        options: Array.isArray(q.options) ? q.options.map((o: any) => String(o ?? '').trim()) : [],
        correct: Number.isInteger(q.correct) ? q.correct : 0,
        explanation: q.explanation ? String(q.explanation).trim() : undefined,
      }))
      .filter((q) => q.question && q.options.length >= 2)
      .map((q) => {
        const options = [...q.options];
        while (options.length < 4) options.push('');
        if (options.length > 4) options.length = 4;
        const correct = q.correct >= 0 && q.correct < 4 ? q.correct : 0;
        return { question: q.question, options, correct, explanation: q.explanation };
      });
  }
}
