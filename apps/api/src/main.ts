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

  // 反向代理支持：默认只信任本机回环代理（nginx 同机部署的典型场景），
  // 可用 TRUST_PROXY 覆盖（数字 = 信任跳数，或逗号分隔的 IP/CIDR，或 "loopback"/"linklocal" 等 express 关键字）。
  // express 在 app.set() 时就会编译该值，非法取值（含空串）会直接抛错导致进程起不来，
  // 所以这里对空值回落默认值，并把字符串 "true"/"false" 映射成布尔。
  // 这一步决定 req.ip 的取值，进而决定限流分桶与审计/去重 IP —— 必须在 app.listen 前设置。
  const trustProxyRaw = (config.get<string>('TRUST_PROXY') ?? '').trim() || 'loopback';
  const trustProxy: boolean | number | string = /^\d+$/.test(trustProxyRaw)
    ? Number(trustProxyRaw)
    : trustProxyRaw === 'true'
      ? true
      : trustProxyRaw === 'false'
        ? false
        : trustProxyRaw;
  app.set('trust proxy', trustProxy);

  app.setGlobalPrefix('api/v1');

  // 基础安全响应头（不引入 helmet 依赖；与 nginx 侧安全头叠加生效）
  app.use(
    (
      _req: unknown,
      res: { setHeader: (name: string, value: string) => void },
      next: () => void,
    ) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.setHeader('X-DNS-Prefetch-Control', 'off');
      res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
      if (isProd) {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      }
      next();
    },
  );

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
    dotfiles: 'deny',
    // 上传目录是不可信内容：禁止被当成 HTML/脚本执行（nosniff + 强制 CSP sandbox）
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      );
      res.setHeader('Content-Disposition', 'inline');
    },
  });

  // Swagger 生产默认关闭：避免把完整 API schema（含全部权限点与字段定义）公网暴露。
  // 开发环境始终开启；生产可用 SWAGGER_ENABLED=true 临时打开。
  const swaggerEnabled = !isProd || config.get<string>('SWAGGER_ENABLED') === 'true';
  if (swaggerEnabled) {
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
  } else {
    logger.log('Swagger 已关闭（生产环境默认关闭，可设 SWAGGER_ENABLED=true 开启）');
  }

  app.enableShutdownHooks();
  await app.listen(port, '0.0.0.0');
  logger.log(`XHCMS API 已启动：http://localhost:${port}/api/v1`);
  if (swaggerEnabled) {
    logger.log(`Swagger 文档：http://localhost:${port}/api/docs`);
  }
}

void bootstrap();
