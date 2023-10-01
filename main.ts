import { Command } from "https://deno.land/x/cliffy@v1.0.0-rc.3/command/mod.ts";
import { startServer } from "./core/server.ts";
import { logger } from "./utils/logging.ts";

// TODO: Validate configuration file with zod.
export interface Config {
  authentication: {
    enabled: boolean;
    api_key: string;
  };
  providers: {
    [key: string]: {
      type:
        | "OpenAI"
        | "Azure OpenAI Service"
        | "Anthropic"
        | "Replicate"
        | "Co:here";
      api_key: string;
      url: string;
    };
  };
  cache?: {
    enabled: boolean; // Whether or not to enable caching.
    ttl: number; // Time to live in seconds.
  } & (
    | {
        storage: "redis";
        hostname: string;
        port: number;
        username?: string;
        password?: string;
        tls?: boolean;
      }
    | {
        storage: "memory";
      }
  );
  rate_limiting?: {
    enabled: boolean; // Whether or not to enable rate limiting.
    window_size: number; // Size of the rate limiting window in seconds.
    limit: number; // Number of requests allowed per window.
  };
  plugins?: {
    sentiment?: {
      enabled: boolean;
      provider: "azure" | "aws";
      credentials:
        | {
            api_key: string; // Azure only.
          }
        | {
            access_key_id: string;
            secret_access_key: string;
          };
    };
    language_detection?: {
      enabled: boolean;
      provider: "azure" | "aws";
      credentials:
        | {
            provider: "azure";
            api_key: string;
          }
        | {
            provider: "aws";
            access_key_id: string;
            secret_access_key: string;
          };
    };
  };
  response_format?: "aigate" | "default"; // aigate or default. Default will return the raw response from the provider.
}

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
    }
  )
  .description("Start the proxy server on the specified port.")
  .action((options) => {
    let config: Config;

    // Check if the configuration file exists.
    try {
      const jsonFile = Deno.readTextFileSync(options.config);
      config = JSON.parse(jsonFile);
    } catch (err) {
      logger.error(
        err,
        "An error occurred while reading the configuration file."
      );
      Deno.exit(1);
    }

    // Check if the specified port is valid.
    if (options.port < 1 || options.port > 65535) {
      logger.error(
        `Invalid port specified: ${options.port}. Port must be between 1 and 65535.`
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
        2
      )
    );
  });

await new Command()
  .name("aigate")
  .version("0.1.0")
  .description(
    "AIGate allows you to integrate with Generative AI providers like OpenAI, Anthropic, and others using a simple CLI.\n\n" +
      "For more information, please visit https://www.spotllm.com/aigate"
  )
  .command("start", start)
  .command("init", init)
  .parse(Deno.args);
