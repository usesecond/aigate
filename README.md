# AIGate

AIGate allows you to access the Generative AI providers through a proxy server which allows you to gather analytics, use uniform request and response formats, and use a single API key for all providers.

## Installation

You can use binary releases or build from source. We use [Deno](https://deno.land/) to build and run the server.

### Binary Releases

You can download the latest binary release from the [releases page](/releases/latest). The binary is a single executable file that you can run
from the command line.

### Build from Source

You can build the server from source using the following command:

```bash
deno compile --allow-read --allow-env --allow-net  --allow-sys --check main.ts
```

## Usage

You can run the server using the following command:

```bash
./aigate start
```

The server will start on port 8080 by default. You can change the port using the `--port` flag.

```bash
./aigate start --port 8081
```

You can also use the `--help` flag to see all available options.

```bash
./aigate --help
```

## Configuration

You can configure the server using the `config.json` file. The file is automatically created when you run the server for the first time. You can also create the file manually using the following command:

```bash
./aigate init
```

## Providers

AIGate supports the following providers:

- [OpenAI](https://openai.com/)
- [Azure OpenAI Service](https://azure.microsoft.com/en-us/products/ai-services/openai-service/)

## Features

AIGate supports various features that are not available in the original providers. Let's take a look at some of these features.

### Plugins

We support plugins that allow you to add new features to the server. You can find a list of available plugins in the [plugins](/plugins) directory.

Custom plugins are not supported yet. We are working on a plugin system that will allow you to create your own plugins, similar to middleware approach in API frameworks.

### Analytics

You can track languages, sentiment, and other analytics for each request. You can also track the number of requests made to each provider. You can forward analytics to a database or a third-party service such as [Datadog](https://www.datadoghq.com/).

### Rate Limiting

You can limit the number of overall requests to the server and the number of requests to each provider. You can also limit the number of requests per user.

This will allow you to control the costs and prevent abuse.

### Caching

You can cache the responses to reduce the number of requests to the providers. It is possible to use different cache stores including in-memory cache and Redis.

Cache is based on the request parameters and the response and supported with completions, chat completions, and embeddings endpoints.

### Response Formats

You can use the responses as-is from the Generative AI providers or you can use a unified response format. The unified response format is heavily inspired by the [OpenAI API](https://platform.openai.com/docs/api-reference).

### Cost Tracking

Enabling cost tracking will allow you to track the cost of each request. If you have custom pricing for each provider, you can configure the cost per token for each provider.

### Privacy and Security

You deploy AIGate on your own server and you have full control over the data. You can also use the server behind a firewall or a VPN. You can put AIGate behind a reverse proxy such as [Nginx](https://www.nginx.com/) or [Caddy](https://caddyserver.com/) to add additional security features such as TLS.