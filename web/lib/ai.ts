import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
export { AVAILABLE_MODELS, DEFAULT_PRIMARY_MODEL, DEFAULT_SECONDARY_MODEL } from "./models";
export type { AIModel } from "./models";
import { AVAILABLE_MODELS, DEFAULT_PRIMARY_MODEL } from "./models";

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
