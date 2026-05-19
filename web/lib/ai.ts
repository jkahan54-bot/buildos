import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

export type AIModel = {
  id: string;
  name: string;
  provider: "anthropic" | "openai";
  description: string;
};

export const AVAILABLE_MODELS: AIModel[] = [
  { id: "claude-sonnet-4-6",     name: "Claude Sonnet 4.6",   provider: "anthropic", description: "Fast, smart — best for daily use" },
  { id: "claude-opus-4-7",       name: "Claude Opus 4.7",     provider: "anthropic", description: "Most powerful Claude — complex analysis" },
  { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5", provider: "anthropic", description: "Fastest Claude — quick field checks" },
  { id: "gpt-4o",                name: "GPT-4o",              provider: "openai",    description: "OpenAI flagship — cross-checks Claude" },
  { id: "gpt-4o-mini",           name: "GPT-4o Mini",         provider: "openai",    description: "Fast OpenAI — quick verifications" },
];

export const DEFAULT_PRIMARY_MODEL   = "claude-sonnet-4-6";
export const DEFAULT_SECONDARY_MODEL = "gpt-4o";

const anthropic  = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const getOpenAI  = () => new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "placeholder" });

export async function callAI(
  modelId: string,
  system: string,
  userMessage: string,
  maxTokens = 1000
): Promise<string> {
  const model = AVAILABLE_MODELS.find((m) => m.id === modelId);
  if (!model) throw new Error(`Unknown model: ${modelId}`);

  if (model.provider === "anthropic") {
    const res = await anthropic.messages.create({
      model: modelId,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: userMessage }],
    });
    return (res.content[0] as { text: string }).text;
  }

  const res = await getOpenAI().chat.completions.create({
    model: modelId,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: system },
      { role: "user", content: userMessage },
    ],
  });
  return res.choices[0].message.content ?? "";
}

export async function dualReview(
  content: string,
  context: string,
  primaryModel  = DEFAULT_PRIMARY_MODEL,
  secondaryModel = DEFAULT_SECONDARY_MODEL
) {
  const system1 = `You are a construction AI assistant. ${context} Return ONLY valid JSON.`;
  const system2 = `You are a construction QA reviewer cross-checking AI output. ${context} Return ONLY valid JSON.`;

  const [primary, secondary] = await Promise.allSettled([
    callAI(primaryModel,   system1, content, 800),
    callAI(secondaryModel, system2, content, 800),
  ]);

  return {
    primary:   primary.status   === "fulfilled" ? primary.value   : null,
    secondary: secondary.status === "fulfilled" ? secondary.value : null,
    primaryModel,
    secondaryModel,
  };
}
