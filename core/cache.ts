import { connect, type Redis } from "https://deno.land/x/redis@v0.31.0/mod.ts";
import { Config } from "../main.ts";

export interface Cacher {
  /**
   * Get a key from the cache.
   *
   * @param key Key to get.
   * @returns Value of the key, or null if it doesn't exist.
   */
  get(key: string): Promise<string | null>;
  /**
   * Set a key in the cache.
   *
   * @param key Key to set.
   * @param value Value to set.
   * @returns Nothing.
   */
  set(key: string, value: string): Promise<void>;
}

class RedisCacher implements Cacher {
  private redis: Promise<Redis>;
  private ttl?: number;

  constructor(
    hostname: string,
    port: number,
    username?: string,
    password?: string,
    tls?: boolean,
    ttl?: number,
  ) {
    this.redis = connect({
      hostname: hostname,
      port: port,
      ...(username && { username: username }),
      ...(password && { password: password }),
      ...(tls && { tls: true }),
    });

    this.ttl = ttl;
  }

  async get(key: string): Promise<string | null> {
    const client = await this.redis;
    const value = await client.get(key);
    return value;
  }

  async set(key: string, value: string): Promise<void> {
    const client = await this.redis;
    await client.set(key, value, { ex: this.ttl });
  }
}

class MemoryCacher implements Cacher {
  private ttl?: number;
  private cache: Map<
    string,
    {
      value: string;
      expires?: number;
    }
  > = new Map();

  constructor(ttl?: number) {
    this.ttl = ttl;

    // Start the purge interval if TTL is set.
    if (this.ttl) {
      this.purgeInterval;

      // Stop the purge interval when the program exits.
      addEventListener("unload", () => {
        clearInterval(this.purgeInterval);
      });
    }
  }

  // deno-lint-ignore require-await
  async get(key: string): Promise<string | null> {
    const value = this.cache.get(key);
    if (!value) {
      return null;
    }

    if (value.expires && Date.now() > value.expires) {
      this.cache.delete(key);
      return null;
    }

    return value.value;
  }

  // deno-lint-ignore require-await
  async set(key: string, value: string): Promise<void> {
    this.cache.set(key, {
      value: value,
      ...(this.ttl && { expires: Date.now() + this.ttl * 1000 }),
    });
  }

  // Purge expired keys every 10 seconds.
  private purgeInterval = setInterval(() => {
    for (const [key, value] of this.cache.entries()) {
      if (value.expires && Date.now() > value.expires) {
        this.cache.delete(key);
      }
    }
  }, 10000);
}

export function getCacher(config: Config): Cacher {
  if (config.cache?.storage === "redis") {
    if (!config.cache.hostname || !config.cache.port) {
      throw new Error(
        "Hostname and port are required for Redis cache storage.",
      );
    }

    return new RedisCacher(
      config.cache.hostname,
      config.cache.port,
      config.cache.username,
      config.cache.password,
      config.cache.tls,
      config.cache.ttl,
    );
  } else {
    return new MemoryCacher(config.cache?.ttl);
  }
}
