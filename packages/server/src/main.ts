import { loadConfig } from "./config.js";
import { buildServer } from "./server.js";

async function main(): Promise<void> {
  const config = loadConfig();

  console.log("DATABASE_URL =", process.env.DATABASE_URL);
  console.log("CONFIG =", config);

  const app = await buildServer(config);

  try {
    await app.listen({ host: config.host, port: config.port });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void main();