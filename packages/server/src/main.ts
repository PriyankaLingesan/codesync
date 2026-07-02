import { loadConfig } from "./config.js";
import { buildServer } from "./server.js";

async function main(): Promise<void> {
  const config = loadConfig();

  const app = await buildServer(config);

  app.log.info({
    DATABASE_URL: process.env.DATABASE_URL,
    CONFIG: config
  });

  try {
    await app.listen({ host: config.host, port: config.port });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void main();