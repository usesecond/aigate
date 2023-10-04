import { z } from "https://deno.land/x/zod@v3.22.2/mod.ts";
import { logger } from "../utils/logging.ts";

export type AzureOpenAIOpts = {
  stream?: boolean;
  deploymentId?: string;
  apiKey: string;
  url: string;
};

export const AzureOpenAIChatCompletionArgs = z.object({
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

export const AzureOpenAICompletionArgs = z.object({
  prompt: z.string().optional(),
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

export const AzureOpenAIAudioTranscriptionArgs = z.object({
  // File is blob
  file: z.any(),
  prompt: z.string().optional(),
  temperature: z.number().optional(),
  response_format: z
    .enum(["json", "text", "srt", "vtt", "verbose_json"])
    .optional(),
  language: z.string().min(2).max(2).optional(), // ISO 639-1 code.
});

export const AzureOpenAIAudioTranslationArgs = z.object({
  file: z.any(),
  prompt: z.string().optional(),
  response_format: z
    .enum(["json", "text", "srt", "vtt", "verbose_json"])
    .optional(),
  temperature: z.number().optional(),
});

export const AzureOpenAIEmbeddingsArgs = z.object({
  input: z.string(),
  user: z.string().optional(),
});

export const AzureOpenAIImageGenerationArgs = z.object({
  prompt: z.string(),
  n: z.number().optional(),
  size: z.enum(["256x256", "512x512", "1024x1024"]).optional(),
});

/**
 * Send a chat completion request to the OpenAI API.
 *
 * @param model Model to use.
 * @param messages Messages to use.
 * @param opts Options.
 */
export async function chatCompletion(
  opts: AzureOpenAIOpts,
  args?: z.infer<typeof AzureOpenAIChatCompletionArgs>,
) {
  logger.debug(
    {
      opts,
      args,
    },
    "Sending Azure OpenAI chat completion request",
  );

  const resp = await fetch(
    `${opts.url}/openai/deployments/${opts.deploymentId}/chat/completions?api-version=2023-08-01-preview`,
    {
      method: "POST",
      headers: {
        "api-key": opts.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...args,
        stream: opts.stream ?? false,
      }),
    },
  );

  if (opts.stream) {
    logger.debug("Received Azure OpenAI chat completion response (streaming)");
    return resp;
  }

  const json = await resp.json();
  logger.debug({ json }, "Received Azure OpenAI chat completion response");

  return json;
}

/**
 * Send a completion request to the OpenAI API.
 *
 * @param model Model to use.
 * @param prompt Prompt to use.
 * @param opts Options.
 */
export async function completion(
  opts: AzureOpenAIOpts,
  args: z.infer<typeof AzureOpenAICompletionArgs>,
) {
  logger.debug(
    {
      opts,
      args,
    },
    "Sending Azure OpenAI completion request",
  );

  const resp = await fetch(
    `${opts.url}/openai/deployments/${opts.deploymentId}/completions?api-version=2023-08-01-preview`,
    {
      method: "POST",
      headers: {
        "api-key": opts.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    },
  );

  const json = await resp.json();

  logger.debug({ json }, "Received Azure OpenAI completion response");

  return json;
}

/**
 * Audio transcription using the OpenAI API.
 *
 * @param model Model to use.
 * @param audio Audio to transcribe.
 * @param opts Options.
 */
export async function audioTranscription(
  opts: AzureOpenAIOpts,
  args: z.infer<typeof AzureOpenAIAudioTranscriptionArgs>,
) {
  logger.debug(
    {
      opts,
      // Do not log whole args.file
      args: {
        ...args,
        file: {
          originalname: args.file.originalname,
          mimetype: args.file.mimetype,
          size: args.file.size,
        },
      },
    },
    "Sending Azure OpenAI audio transcription request",
  );

  const formData = new FormData();

  const file = new File([args.file.buffer], args.file.originalname, {
    type: args.file.mimetype,
  });
  formData.append("file", file);

  for (const [key, value] of Object.entries(args)) {
    if (key === "file") continue;
    formData.append(key, value);
  }

  const resp = await fetch(
    `${opts.url}/openai/deployments/${opts.deploymentId}/audio/transcriptions?api-version=2023-09-01-preview`,
    {
      method: "POST",
      headers: {
        "api-key": opts.apiKey,
      },
      body: formData,
    },
  );

  // Response may not be JSON.
  const respData = await resp.text();
  const respContentType = resp.headers.get("Content-Type") || "text/plain";

  logger.debug(
    { respData },
    "Received Azure OpenAI audio transcription response",
  );

  return {
    data: respData,
    contentType: respContentType,
  };
}

/**
 * Audio translation using the OpenAI API.
 *
 * @param opts Options.
 * @param args Arguments.
 */
export async function audioTranslation(
  opts: AzureOpenAIOpts,
  args: z.infer<typeof AzureOpenAIAudioTranslationArgs>,
) {
  logger.debug(
    {
      opts,
      args: {
        ...args,
        file: {
          originalname: args.file.originalname,
          mimetype: args.file.mimetype,
          size: args.file.size,
        },
      },
    },
    "Sending Azure OpenAI audio translation request",
  );

  const formData = new FormData();

  const file = new File([args.file.buffer], args.file.originalname, {
    type: args.file.mimetype,
  });
  formData.append("file", file);

  for (const [key, value] of Object.entries(args)) {
    if (key === "file") continue;
    formData.append(key, value);
  }

  const resp = await fetch(
    `${opts.url}/openai/deployments/${opts.deploymentId}/audio/translations?api-version=2023-09-01-preview`,
    {
      method: "POST",
      headers: {
        "api-key": opts.apiKey,
      },
      body: formData,
    },
  );

  // Response may not be JSON.
  const respData = await resp.text();
  const respContentType = resp.headers.get("Content-Type") || "text/plain";

  logger.debug(
    { respData },
    "Received Azure OpenAI audio translation response",
  );

  return {
    data: respData,
    contentType: respContentType,
  };
}

/**
 * Create embeddings using the OpenAI API.
 *
 * @param model Model to use.
 * @param input Text to embed.
 * @param opts Options.
 */
export async function embeddings(
  opts: AzureOpenAIOpts,
  args: z.infer<typeof AzureOpenAIEmbeddingsArgs>,
) {
  logger.debug(
    {
      opts,
      args,
    },
    "Sending Azure OpenAI embeddings request",
  );

  const resp = await fetch(
    `${opts.url}/openai/deployments/${opts.deploymentId}/embeddings?api-version=2023-08-01-preview`,
    {
      method: "POST",
      headers: {
        "api-key": opts.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    },
  );

  const json = await resp.json();

  logger.debug({ json }, "Received Azure OpenAI embeddings response");

  return json;
}

/**
 * Generate images using the OpenAI API.
 *
 * @param model Model to use.
 * @param prompt Prompt to use.
 * @param opts Options.
 */
export async function imageGeneration(
  opts: AzureOpenAIOpts,
  args: z.infer<typeof AzureOpenAIImageGenerationArgs>,
) {
  logger.debug(
    {
      opts,
      args,
    },
    "Sending Azure OpenAI image generation request",
  );

  const resp = await fetch(
    `${opts.url}/openai/images/generations:submit?api-version=2023-08-01-preview`,
    {
      method: "POST",
      headers: {
        "api-key": opts.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    },
  );

  if (!resp.ok) {
    throw new Error(
      `Received non-OK response from Azure OpenAI image generation: ${resp.status} ${resp.statusText}`,
    );
  } else {
    const json = await resp.json();
    logger.debug(
      { json },
      "Received Azure OpenAI image generation request response",
    );

    let success = false;
    let tries = 0;

    // Try to get the result until it is ready.
    while (!success && tries < 10) {
      logger.debug("Trying to get Azure OpenAI image generation result");

      const resultResp = await fetch(
        `${opts.url}/openai/operations/images/${json.id}?api-version=2023-08-01-preview`,
        {
          method: "GET",
          headers: {
            "api-key": opts.apiKey,
          },
        },
      );

      const resultJson = await resultResp.json();

      logger.debug(
        { resultJson },
        "Received Azure OpenAI image generation result response",
      );

      if (resultJson.status === "succeeded") {
        success = true;
        return resultJson.result;
      } else if (
        resultJson.status === "failed" ||
        resultJson.status === "canceled" ||
        resultJson.status === "deleted"
      ) {
        throw new Error(
          `Azure OpenAI image generation failed: ${resultJson.error.message}`,
        );
      } else {
        // Wait 1 second before trying again.
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      tries++;
    }

    throw new Error("Azure OpenAI image generation timed out after 10 tries");
  }
}
