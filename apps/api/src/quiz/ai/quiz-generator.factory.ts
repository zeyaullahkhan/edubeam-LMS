import { AiNotConfiguredError, type QuizGenerator } from './quiz-generator.interface';
import { GeminiQuizGenerator } from './gemini.generator';
import { AnthropicQuizGenerator } from './anthropic.generator';

// Lazily builds the active generator from QUIZ_AI_PROVIDER. Constructed once and
// reused; if no provider is configured, returns null so the service can surface
// a friendly "AI not configured" message instead of crashing at boot.
let cached: QuizGenerator | null | undefined;

export function getQuizGenerator(): QuizGenerator | null {
  if (cached !== undefined) return cached;
  cached = build();
  return cached;
}

function build(): QuizGenerator | null {
  const provider = (process.env.QUIZ_AI_PROVIDER ?? 'gemini').toLowerCase();
  try {
    if (provider === 'anthropic') {
      return new AnthropicQuizGenerator(process.env.ANTHROPIC_API_KEY ?? '');
    }
    if (provider === 'gemini') {
      return new GeminiQuizGenerator(process.env.GEMINI_API_KEY ?? '');
    }
    // Unknown provider — treat as unconfigured.
    return null;
  } catch (e) {
    if (e instanceof AiNotConfiguredError) return null;
    throw e;
  }
}

// Test/seed hook to reset the memoized instance.
export function resetQuizGenerator() {
  cached = undefined;
}
