import 'reflect-metadata';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import hpp from 'hpp';
import morgan from 'morgan';
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { NODE_ENV, PORT, LOG_FORMAT, ORIGIN, CREDENTIALS } from '@config';
import { dbConnection } from '@database';
import { Routes } from '@interfaces/routes.interface';
import { ErrorMiddleware } from '@middlewares/error.middleware';
import { logger, stream } from '@utils/logger';
import path from 'path';

export class App {
  public app: express.Application;
  public env: string;
  public port: string;

  constructor(routes: Routes[]) {
    this.app = express();
    this.env = NODE_ENV || 'development';
    this.port = PORT || '5000';

    this.connectToDatabase();
    this.initializeMiddlewares();
    this.initializeRoutes(routes);
    this.initializeSwagger();
    this.initializeErrorHandling();
  }

  public listen() {
    this.app.listen(this.port, () => {
      logger.info(`=================================`);
      logger.info(`======= ENV: ${this.env} =======`);
      logger.info(`🚀  chatSSE API listening on port ${this.port}`);
      logger.info(`=================================`);
    });

    // Re-sync fee invoice + contract indexes on startup. Older
    // deployments may carry orphan unique indexes that no longer
    // match the current schema — syncIndexes() drops indexes not
    // declared on the schema and creates the ones that are, healing
    // the collection without manual DB work. The orphan `paymentNo_1`
    // index on feepayments was removed in the Real_Estate alignment;
    // payments now use the CounterModel for atomic numbering, so no
    // unique index is required on that collection.
    // this.syncFeeIndexes();
  }



  public getServer() {
    return this.app;
  }

  private async connectToDatabase() {
    await dbConnection();
  }

  private initializeMiddlewares() {
    this.app.set('trust proxy', 1);

    const allowedOriginPatterns = [
      /^https?:\/\/([a-zA-Z0-9-]+\.)*lmstream\.xyz(:\d+)?$/,
      /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/,
    ];

    const allowedOrigins = [
      'http://192.168.0.11:3000',
    ];

    const corsOptions: cors.CorsOptions = {
      origin: (requestOrigin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
        if (!requestOrigin) {
          return callback(null, true);
        }

        const isPatternAllowed = allowedOriginPatterns.some(pattern => pattern.test(requestOrigin));
        if (isPatternAllowed) {
          return callback(null, true);
        }

        if (ORIGIN && (ORIGIN === '*' || requestOrigin === ORIGIN)) {
          return callback(null, true);
        }

        if (allowedOrigins.includes(requestOrigin)) {
          return callback(null, true);
        }

        return callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-device-id', 'x-device-label', 'Accept', 'Origin'],
      exposedHeaders: ['Set-Cookie', 'Content-Disposition'],
      optionsSuccessStatus: 204,
    };

    this.app.use(cors(corsOptions));
    this.app.options('*', cors(corsOptions));
    this.app.use(hpp());
    this.app.use(helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginEmbedderPolicy: false,
    }));
    this.app.use(compression({
      filter: (req, res) => {
        if (req.headers.accept && req.headers.accept.includes('text/event-stream')) {
          return false;
        }
        return compression.filter(req, res);
      },
    }));
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));
    this.app.use(cookieParser());
    this.app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  }

  private initializeRoutes(routes: Routes[]) {
    routes.forEach(route => {
      this.app.use('/', route.router);
    });
  }

  private initializeSwagger() {
    const options = {
      swaggerDefinition: {
        info: {
          title: ' Management chatSSE API',
          version: '1.0.0',
          description: 'REST API for  Management chatSSE',
        },
      },
      apis: ['swagger.yaml'],
    };

    const specs = swaggerJSDoc(options);
    this.app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
  }

  private initializeErrorHandling() {
    this.app.use(ErrorMiddleware);
  }
}
