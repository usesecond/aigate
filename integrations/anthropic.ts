import { z } from "https://deno.land/x/zod@v3.22.2/mod.ts";
import { logger } from "../utils/logging.ts";

export type AnthropicOpts = {
  stream?: boolean;
  apiKey: string;
};

const CommonArgs = z.object({
  model: z.string(),
  max_tokens_to_sample: z.number().default(15),
  stop_sequences: z.array(z.string()).optional(),
  temperature: z.number().optional(),
  top_p: z.number().optional(),
  top_k: z.number().optional(),
  metadata: z.record(z.string()).optional(),
});

export const AnthropicCompletionArgs = CommonArgs.extend({
  prompt: z.string(),
});

export const AnthropicChatCompletionArgs = CommonArgs.extend({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .min(1),
});

export async function completion(
  opts: AnthropicOpts,
  args: z.infer<typeof AnthropicCompletionArgs>,
) {
  logger.debug({ opts, args }, "Anthropic completion");

  const resp = await fetch("https://api.anthropic.com/v1/complete", {
    headers: {
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
      "x-api-key": opts.apiKey,
    },
    method: "POST",
    body: JSON.stringify({
      ...args,
      stream: opts.stream ?? false,
    }),
  });

  if (opts.stream) {
    return resp;
  } else {
    const json = await resp.json();
    return json;
  }
}

export async function chatCompletion(
  opts: AnthropicOpts,
  args: z.infer<typeof AnthropicChatCompletionArgs>,
) {
  logger.debug({ opts, args }, "Anthropic chat completion");

  const prompt = args.messages
    .map((message) => {
      const role = message.role == "user" ? "Human" : "Assistant";

      return `\n\n${role}: ${message.content}`;
    })
    .join("") + "\n\nAssistant:";

  const resp = await completion(opts, {
    prompt: prompt,
    model: args.model,
    max_tokens_to_sample: args.max_tokens_to_sample,
    stop_sequences: args.stop_sequences,
    temperature: args.temperature,
    top_p: args.top_p,
    top_k: args.top_k,
    metadata: args.metadata,
  });

  return resp;
}
