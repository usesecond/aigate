// @deno-types="npm:@types/express@4.17.15"
import express from "npm:express@4.18.2";
import multer from "npm:multer";
import { rateLimit } from "npm:express-rate-limit@7.0.2";
import { Config } from "../main.ts";
import { Cacher, getCacher } from "./cache.ts";
import * as oai from "../integrations/openai.ts";
import * as azoai from "../integrations/azure-openai.ts";
import { logger } from "../utils/logging.ts";

let config: Config;
let cacher: Cacher | undefined; // Cacher is optional.

const app = express();
app.use(express.json());
app.disable("x-powered-by");

const upload = multer();

/**
 * Start the proxy server on the specified port.
 *
 * Config is passed in from the main module.
 *
 * @param port Port to start the proxy server on.
 * @param cfg Configuration object.
 * @returns Nothing.
 */
export function startServer(port: number, cfg: Config) {
  config = cfg;

  if (config.rate_limiting?.enabled) {
    console.debug("✓ Rate limiting enabled.");
    app.use(
      rateLimit({
        windowMs: config.rate_limiting.window_size * 1000,
        max: config.rate_limiting.limit,
        keyGenerator: () => {
          return ""; // We use a global rate limit.
        },
      }),
    );
  }

  if (config.authentication?.enabled) {
    console.debug("✓ Authentication enabled.");
    app.use((req, res, next) => {
      const auth = req.header("X-API-Key");

      if (!auth) {
        res.status(401).json({
          error: "Authentication required.",
          source: "proxy",
        });
        return;
      }

      if (auth !== config.authentication?.api_key) {
        res.status(403).json({
          error: "Invalid API key.",
          source: "proxy",
        });
        return;
      }

      next();
    });
  }

  if (config.cache?.enabled) {
    console.debug("✓ Caching enabled.");
    cacher = getCacher(config);
  }

  app.post("/chat/completion", async (req, res) => {
    const data = req.body;

    const provider = data.provider || req.header("X-Provider");

    // Check if provider exists in config.
    if (!config.providers[provider]) {
      res.status(400).json({
        error: "Invalid provider.",
        source: "proxy",
      });
      return;
    }

    const providerConfig = config.providers[provider];

    try {
      if (cacher && !req.header("Cache-Control")?.includes("no-cache")) {
        const cached = await cacher.get(JSON.stringify({ provider, data }));

        if (cached) {
          res.header("X-Cache-Status", "HIT").json({
            ...JSON.parse(cached),
            cached: true,
          });
          return;
        }
      }

      if (providerConfig.type === "OpenAI") {
        if (data.stream) {
          // TODO: Implement streaming.
        } else {
          // OpenAIChatCompletionArgs
          // Get the args from data (only in type OpenAIChatCompletionArgs)
          const resp = await oai.chatCompletion(
            {
              apiKey: providerConfig.api_key as string,
            },
            oai.OpenAIChatCompletionArgs.parse(data),
          );

          res.json(resp);

          cacher?.set(JSON.stringify({ provider, data }), JSON.stringify(resp));
          return;
        }
      } else if (providerConfig.type === "Azure OpenAI Service") {
        const deploymentId = req.header("Azure-OpenAI-Deployment-Id") ||
          data.deploymentId;

        if (data.stream) {
          // TODO: Implement streaming.
        } else {
          const resp = await azoai.chatCompletion(
            {
              apiKey: providerConfig.api_key as string,
              deploymentId: deploymentId,
              url: providerConfig.url as string,
            },
            azoai.AzureOpenAIChatCompletionArgs.parse(data),
          );

          res.json(resp);

          cacher?.set(JSON.stringify({ provider, data }), JSON.stringify(resp));
          return;
        }
      }
    } catch (e) {
      logger.error(e, "Error while proxying request");
      res.status(500).json({
        error: "Internal server error.",
        message: JSON.parse(e.message),
        source: "proxy",
      });
      return;
    }
  });

  app.post("/completion", async (req, res) => {
    const data = req.body;

    const provider = data.provider || req.header("X-Provider");

    // Check if provider exists in config.
    if (!config.providers[provider]) {
      res.status(400).json({
        error: "Invalid provider.",
        source: "proxy",
      });
      return;
    }

    const providerConfig = config.providers[provider];

    try {
      if (cacher && !req.header("Cache-Control")?.includes("no-cache")) {
        const cached = await cacher.get(JSON.stringify({ provider, data }));

        if (cached) {
          res.header("X-Cache-Status", "HIT").json({
            ...JSON.parse(cached),
            cached: true,
          });
          return;
        }
      }

      if (providerConfig.type === "OpenAI") {
        const resp = await oai.completion(
          data.model,
          data.prompt,
          {
            apiKey: providerConfig.api_key as string,
            stream: data?.stream,
          },
          oai.OpenAICompletionArgs.parse(data),
        );

        res.json(resp);
        cacher?.set(JSON.stringify({ provider, data }), JSON.stringify(resp));
        return;
      } else if (providerConfig.type === "Azure OpenAI Service") {
        const deploymentId = req.header("Azure-OpenAI-Deployment-Id") ||
          data.deploymentId;

        const resp = await azoai.completion(
          {
            apiKey: providerConfig.api_key as string,
            deploymentId: deploymentId,
            url: providerConfig.url as string,
          },
          azoai.AzureOpenAICompletionArgs.parse(data),
        );

        res.json(resp);
        cacher?.set(JSON.stringify({ provider, data }), JSON.stringify(resp));
        return;
      }
    } catch (_e) {
      res.status(500).json({
        error: "Internal server error.",
        message: _e.message,
        source: "proxy",
      });
      return;
    }
  });

  app.post("/audio/transcriptions", upload.single("file"), async (req, res) => {
    const data = req.body;

    const provider = data.provider || req.header("X-Provider");

    // Check if provider exists in config.
    if (!config.providers[provider]) {
      res.status(400).json({
        error: "Invalid provider.",
        source: "proxy",
      });
      return;
    }

    const providerConfig = config.providers[provider];

    try {
      const fileHash = await crypto.subtle.digest(
        "SHA-256",
        // deno-lint-ignore no-explicit-any
        (req as any).file.buffer,
      );

      if (cacher && !req.header("Cache-Control")?.includes("no-cache")) {
        const cached = await cacher.get(
          JSON.stringify({ provider, data, fileHash }),
        );

        if (cached) {
          const resp = JSON.parse(cached);

          res
            .header("X-Cache-Status", "HIT")
            .header("Content-Type", resp.contentType)
            .send(resp.data);

          return;
        }
      }

      if (providerConfig.type === "OpenAI") {
        // TODO: Implement audio transcription.
      } else if (providerConfig.type === "Azure OpenAI Service") {
        const deploymentId = req.header("Azure-OpenAI-Deployment-Id") ||
          data.deploymentId;

        const resp = await azoai.audioTranscription(
          {
            apiKey: providerConfig.api_key as string,
            deploymentId: deploymentId,
            url: providerConfig.url as string,
          },
          azoai.AzureOpenAIAudioTranscriptionArgs.parse({
            // deno-lint-ignore no-explicit-any
            file: (req as any).file,
            ...data,
          }),
        );

        // Response may not be JSON.
        res.header("Content-Type", resp.contentType).send(resp.data);
        cacher?.set(
          JSON.stringify({ provider, data, fileHash }),
          JSON.stringify(resp),
        );
        return;
      }
    } catch (err) {
      logger.error(err, "Error while proxying request");

      res.status(500).json({
        error: "Internal server error.",
        message: err.message,
        source: "proxy",
      });
      return;
    }
  });

  app.post("/audio/translations", upload.single("file"), async (req, res) => {
    const data = req.body;

    const provider = data.provider || req.header("X-Provider");

    // Check if provider exists in config.
    if (!config.providers[provider]) {
      res.status(400).json({
        error: "Invalid provider.",
        source: "proxy",
      });
      return;
    }

    const providerConfig = config.providers[provider];

    try {
      if (providerConfig.type === "OpenAI") {
        // TODO: Implement audio translation.
      } else if (providerConfig.type === "Azure OpenAI Service") {
        const deploymentId = req.header("Azure-OpenAI-Deployment-Id") ||
          data.deploymentId;

        const resp = await azoai.audioTranslation(
          {
            apiKey: providerConfig.api_key as string,
            deploymentId: deploymentId,
            url: providerConfig.url as string,
          },
          azoai.AzureOpenAIAudioTranslationArgs.parse({
            // deno-lint-ignore no-explicit-any
            file: (req as any).file,
            ...data,
          }),
        );

        // Response may not be JSON.
        res.header("Content-Type", resp.contentType).send(resp.data);

        return;
      }
    } catch (_e) {
      res.status(500).json({
        error: "Internal server error.",
        message: _e.message,
        source: "proxy",
      });
      return;
    }
  });

  app.post("/embeddings", async (req, res) => {
    const data = req.body;

    const provider = data.provider || req.header("X-Provider");

    // Check if provider exists in config.
    if (!config.providers[provider]) {
      res.status(400).json({
        error: "Invalid provider.",
        source: "proxy",
      });
      return;
    }

    const providerConfig = config.providers[provider];

    try {
      if (providerConfig.type === "OpenAI") {
        return;
      } else if (providerConfig.type === "Azure OpenAI Service") {
        const deploymentId = req.header("Azure-OpenAI-Deployment-Id") ||
          data.deploymentId;

        const resp = await azoai.embeddings(
          {
            apiKey: providerConfig.api_key as string,
            deploymentId: deploymentId,
            url: providerConfig.url as string,
          },
          azoai.AzureOpenAIEmbeddingsArgs.parse(data),
        );

        res.json(resp);
        return;
      }
    } catch (_e) {
      res.status(500).json({
        error: "Internal server error.",
        message: JSON.parse(_e.message),
        source: "proxy",
      });
      return;
    }
  });

  app.listen({ port: port });
}
