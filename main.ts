import { Command } from "https://deno.land/x/cliffy@v1.0.0-rc.3/command/mod.ts";
import { startServer } from "./core/server.ts";
import { logger } from "./utils/logging.ts";
import { z } from "https://deno.land/x/zod@v3.22.2/mod.ts";

export const ConfigSchema = z.object({
  authentication: z
    .object({
      enabled: z.boolean(),
      api_key: z.string(),
    })
    .optional(),
  providers: z.record(
    z
      .object({
        type: z.enum([
          "OpenAI",
          "Azure OpenAI Service",
          "Anthropic",
          "Replicate",
          "Co:here",
        ]),
        api_key: z.string(),
        url: z.string().optional(),
      })
      .refine((data) => {
        if (data.type === "Azure OpenAI Service") {
          return data.url !== undefined;
        }
        return true;
      }),
  ),
  cache: z
    .object({
      enabled: z.boolean(),
      ttl: z.number(),
      storage: z.enum(["redis", "memory"]),
      hostname: z.string().optional(),
      port: z.number().optional(),
      username: z.string().optional(),
      password: z.string().optional(),
      tls: z.boolean().optional(),
    })
    .refine((data) => {
      if (data.storage === "redis") {
        // Hostname and port are required for Redis.
        return data.hostname !== undefined && data.port !== undefined;
      }
      return true;
    })
    .optional(),
  rate_limiting: z
    .object({
      enabled: z.boolean(),
      window_size: z.number(),
      limit: z.number(),
    })
    .optional(),
  plugins: z
    .object({
      sentiment: z
        .object({
          enabled: z.boolean(),
          provider: z.enum(["azure", "aws"]),
          credentials: z
            .union([
              z.object({
                provider: z.literal("azure"),
                api_key: z.string(),
              }),
              z.object({
                provider: z.literal("aws"),
                access_key_id: z.string(),
                secret_access_key: z.string(),
              }),
            ])
            .optional(),
        })
        .optional(),
      language_detection: z
        .object({
          enabled: z.boolean(),
          provider: z.enum(["azure", "aws"]),
          credentials: z
            .union([
              z.object({
                provider: z.literal("azure"),
                api_key: z.string(),
              }),
              z.object({
                provider: z.literal("aws"),
                access_key_id: z.string(),
                secret_access_key: z.string(),
              }),
            ])
            .optional(),
        })
        .optional(),
    })
    .optional(),
  response_format: z.enum(["aigate", "default"]).default("aigate"),
});

export type Config = z.infer<typeof ConfigSchema>;

const start = new Command()
  .option("-p, --port <port:number>", "Port to start the proxy server on.", {
    default: 8080,
  })
  .option("-c, --config <config:string>", "Path to the configuration file.", {
    default: "./aigate.json",
    required: true,
  })
  .option(
    "-d, --debug",
    "Enable debug logging. This will log all incoming requests and responses.",
    {
      default: false,
    },
  )
  .description("Start the proxy server on the specified port.")
  .action((options) => {
    let config: Config;

    // Check if the configuration file exists.
    try {
      const jsonFile = Deno.readTextFileSync(options.config);
      const parsedConfig = JSON.parse(jsonFile);
      config = ConfigSchema.parse(parsedConfig);
    } catch (err) {
      logger.error(
        err,
        "An error occurred while reading the configuration file.",
      );
      Deno.exit(1);
    }

    // Check if the specified port is valid.
    if (options.port < 1 || options.port > 65535) {
      logger.error(
        `Invalid port specified: ${options.port}. Port must be between 1 and 65535.`,
      );
      Deno.exit(1);
    }

    // Check if debug logging is enabled.
    if (options.debug) {
      logger.level = "debug";
    } else {
      logger.level = "info";
    }

    // Start the server.
    logger.info(`Starting server on port ${options.port.toString()}.`);
    startServer(options.port, config);
  });

const init = new Command()
  .description("Initialize a new configuration file.")
  .action(() => {
    logger.info("Initializing new configuration file.");
    Deno.writeTextFileSync(
      "./aigate.json",
      JSON.stringify(
        {
          providers: {
            example: {
              type: "OpenAI",
              api_key: "YOUR_API_KEY",
            },
          },
          cache: {
            enabled: true,
            ttl: 60 * 60 * 12,
            storage: "memory",
          },
        },
        null,
        2,
      ),
    );
  });

await new Command()
  .name("aigate")
  .version("0.1.0")
  .description(
    "AIGate allows you to integrate with Generative AI providers like OpenAI, Anthropic, and others using a simple CLI.\n\n" +
      "For more information, please visit https://www.spotllm.com/aigate",
  )
  .command("start", start)
  .command("init", init)
  .parse(Deno.args);
