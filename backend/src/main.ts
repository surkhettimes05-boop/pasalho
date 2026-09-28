import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { resolveTrustProxySetting } from './config/app.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.getHttpAdapter().getInstance().set('trust proxy', resolveTrustProxySetting());


  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  app.setGlobalPrefix('api/v1');

  app.enableCors({
    origin: (origin, callback) => {
      const configuredOrigins = process.env.CORS_ORIGIN;
      const allowedOrigins = configuredOrigins
        ? configuredOrigins.split(',').map((origin) => origin.trim())
        : process.env.NODE_ENV === 'production'
          ? []
          : ['http://localhost:3001', 'http://localhost:3002'];
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  });

  const config = new DocumentBuilder()
    .setTitle('PASALO OS API')
    .setDescription('FMCG Distribution Operating System API')
    .setVersion('0.0.1')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port, () => {
    console.log(`Application running on http://localhost:${port}/api/v1`);
    console.log(`Swagger documentation available at http://localhost:${port}/docs`);
  });
}

bootstrap();
