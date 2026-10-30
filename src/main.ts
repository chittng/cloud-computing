import { NestFactory } from '@nestjs/core';
import { RootModule } from './root.module.ts';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(RootModule);

  await app.listen(process.env.PORT ?? 3000);
}

await bootstrap();
