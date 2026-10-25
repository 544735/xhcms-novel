import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['log', 'warn', 'error'],
  });
  const config = app.get(ConfigService);
  const port = Number(config.get<string>('PORT') ?? 4000);
  const isProd = config.get<string>('NODE_ENV') === 'production';

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
      forbidNonWhitelisted: false,
      stopAtFirstError: false,
    }),
  );

  app.enableCors({
    origin: (config.get<string>('CORS_ORIGINS') ?? 'http://localhost:3000')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Site-Id',
      'X-Request-Id',
      'X-Requested-With',
    ],
    exposedHeaders: ['X-Request-Id'],
  });

  // 上传文件静态托管：/uploads/<siteId>/<yyyyMM>/<file>
  const uploadDir = resolve(process.cwd(), config.get<string>('UPLOAD_DIR') ?? 'uploads');
  mkdirSync(uploadDir, { recursive: true });
  app.useStaticAssets(uploadDir, {
    prefix: '/uploads/',
    maxAge: isProd ? '30d' : 0,
    index: false,
    redirect: false,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('XHCMS 2.0 API')
    .setDescription(
      [
        '现代化内容管理系统 API。',
        '管理端接口需要 `Authorization: Bearer <accessToken>`，站点级接口另需 `X-Site-Id`。',
        '统一响应信封：`{ code, message, data, requestId }`。',
      ].join('\n'),
    )
    .setVersion('2.0.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: '管理端访问令牌' },
      'admin',
    )
    .addApiKey({ type: 'apiKey', name: 'X-Site-Id', in: 'header' }, 'site')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  app.enableShutdownHooks();
  await app.listen(port, '0.0.0.0');
  logger.log(`XHCMS API 已启动：http://localhost:${port}/api/v1`);
  logger.log(`Swagger 文档：http://localhost:${port}/api/docs`);
}

void bootstrap();
