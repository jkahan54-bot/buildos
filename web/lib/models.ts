export type AIModel = {
  id: string;
  name: string;
  provider: "anthropic" | "openai";
  description: string;
};

export const AVAILABLE_MODELS: AIModel[] = [
  { id:"claude-sonnet-4-6",        name:"Claude Sonnet 4.6",  provider:"anthropic", description:"Fast & smart — best for daily use" },
  { id:"claude-opus-4-7",          name:"Claude Opus 4.7",    provider:"anthropic", description:"Most powerful — complex analysis" },
  { id:"claude-haiku-4-5-20251001",name:"Claude Haiku 4.5",   provider:"anthropic", description:"Fastest Claude — quick field checks" },
  { id:"gpt-4o",                   name:"GPT-4o",             provider:"openai",    description:"OpenAI flagship — cross-checks Claude" },
  { id:"gpt-4o-mini",              name:"GPT-4o Mini",        provider:"openai",    description:"Fast OpenAI — quick verifications" },
];

export const DEFAULT_PRIMARY_MODEL   = "claude-sonnet-4-6";
export const DEFAULT_SECONDARY_MODEL = "gpt-4o";
