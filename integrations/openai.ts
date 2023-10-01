import { z } from "https://deno.land/x/zod@v3.22.2/mod.ts";
import { logger } from "../utils/logging.ts";

export type OpenAIOpts = {
  stream?: boolean;
  apiKey: string;
};

export const OpenAIChatCompletionArgs = z.object({
  model: z.string(),
  messages: z
    .array(
      z.object({
        role: z.enum(["system", "user", "assistant", "function"]),
        content: z.string(),
        name: z.string().optional(),
        function_call: z
          .object({
            name: z.string(),
            arguments: z.record(z.any()),
          })
          .optional(),
      }),
    )
    .min(1),
  functions: z
    .array(
      z.object({
        name: z.string(),
        description: z.string().optional(),
        parameters: z.record(z.any()),
      }),
    )
    .optional(),
  function_call: z.string().or(z.record(z.any())).optional(),
  temperature: z.number().optional(),
  top_p: z.number().optional(),
  n: z.number().optional(),
  stop: z.string().or(z.array(z.string())).optional(),
  max_tokens: z.number().optional(),
  presence_penalty: z.number().optional(),
  frequency_penalty: z.number().optional(),
  logit_bias: z.record(z.number()).optional(),
  user: z.string().optional(),
});

export const OpenAICompletionArgs = z.object({
  suffix: z.string().optional(),
  max_tokens: z.number().optional(),
  temperature: z.number().optional(),
  top_p: z.number().optional(),
  n: z.number().optional(),
  logprobs: z.number().optional(),
  echo: z.boolean().optional(),
  stop: z.string().or(z.array(z.string())).optional(),
  presence_penalty: z.number().optional(),
  frequency_penalty: z.number().optional(),
  best_of: z.number().optional(),
  logit_bias: z.record(z.number()).optional(),
  user: z.string().optional(),
});

export const OpenAIAudioTranscriptionArgs = z.object({
  prompt: z.string().optional(),
  temperature: z.number().optional(),
  response_format: z
    .enum(["json", "text", "srt", "vtt", "verbose_json"])
    .optional(),
  language: z.string().min(2).max(2).optional(), // ISO 639-1 code.
});

/**
 * Send a chat completion request to the OpenAI API.
 *
 * @param model Model to use.
 * @param messages Messages to use.
 * @param opts Options.
 */
export async function chatCompletion(
  opts: OpenAIOpts,
  args?: z.infer<typeof OpenAIChatCompletionArgs>,
) {
  logger.debug(
    {
      opts,
      args,
    },
    "Sending OpenAI chat completion request",
  );

  // Check if streaming
  if (opts.stream) {
    // TODO: Implement streaming.
  } else {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });

    const json = await resp.json();

    logger.debug({ json }, "Received OpenAI chat completion response");

    return json;
  }
}

/**
 * Send a completion request to the OpenAI API.
 *
 * @param model Model to use.
 * @param prompt Prompt to use.
 * @param opts Options.
 */
export async function completion(
  model: string,
  prompt: string,
  opts: OpenAIOpts,
  args?: z.infer<typeof OpenAICompletionArgs>,
) {}

/**
 * Audio transcription using the OpenAI API.
 *
 * @param model Model to use.
 * @param audio Audio to transcribe.
 * @param opts Options.
 */
export async function audioTranscription(
  model: string,
  audio: Uint8Array,
  opts: OpenAIOpts,
  args?: z.infer<typeof OpenAIAudioTranscriptionArgs>,
) {}

/**
 * Audio translation using the OpenAI API.
 *
 * @param model Model to use.
 * @param audio Audio to translate.
 * @param opts Options.
 */
export async function audioTranslation(
  model: string,
  audio: Uint8Array,
  opts: OpenAIOpts,
  args?: {
    temperature?: number;
    prompt?: string;
    response_format?: "json" | "text" | "srt" | "vtt" | "verbose_json";
  },
) {}

/**
 * Create embeddings using the OpenAI API.
 *
 * @param model Model to use.
 * @param input Text to embed.
 * @param opts Options.
 */
export async function embeddings(
  model: string,
  input: string,
  opts: OpenAIOpts,
  args?: {
    user?: string;
  },
) {}

/**
 * Generate images using the OpenAI API.
 *
 * @param model Model to use.
 * @param prompt Prompt to use.
 * @param opts Options.
 */
export async function imageGeneration(
  model: string,
  prompt: string,
  opts: OpenAIOpts,
  args?: {
    n?: number;
    size?: string;
    response_format?: "url" | "b64_json";
    user?: string;
  },
) {}

/**
 * Edit images using the OpenAI API.
 *
 * @param model Model to use.
 * @param image Image to edit.
 * @param opts Options.
 */
export async function imageEditing(
  model: string,
  image: Uint8Array,
  opts: OpenAIOpts,
  args?: {
    mask?: Uint8Array;
    n?: number;
    size?: string;
    response_format?: "url" | "b64_json";
    user?: string;
  },
) {}

/**
 * Create image variations using the OpenAI API.
 *
 * @param model Model to use.
 * @param image Image to use.
 * @param opts Options.
 */
export async function imageVariation(
  model: string,
  image: Uint8Array,
  opts: OpenAIOpts,
  args?: {
    n?: number;
    size?: string;
    response_format?: "url" | "b64_json";
    user?: string;
  },
) {}
