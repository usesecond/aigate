import { pino } from "npm:pino";

export const logger = pino({
  level: "debug",
});
