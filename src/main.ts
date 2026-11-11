import { createHttpApp } from "./app.factory.ts";

async function bootstrap(): Promise<void> {
  const app = await createHttpApp();
  await app.listen(process.env.PORT ?? 3000);
}

await bootstrap();
