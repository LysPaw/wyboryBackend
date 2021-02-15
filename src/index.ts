import 'reflect-metadata';
import 'dotenv-safe/config';
import express from 'express';
import { createConnection } from 'typeorm';
import Redis from 'ioredis';
import session from 'express-session';
import connectRedis from 'connect-redis';
import path from 'path';
import { User } from './entities/User';
import { ApolloServer } from 'apollo-server-express';
import { buildSchema } from 'type-graphql';
import { UserResolver } from './resolvers/user';
import { Constituency } from './entities/Constituency';
import { COOKIE_NAME, __prod__ } from './constants';
import cors from 'cors';
import { PreActivatedUser } from './entities/PreActivatedUser';
import { AdminResolver } from './resolvers/admin';
import { ConstituencyResolver } from './resolvers/constituency';

(async () => {
  const connection = await createConnection({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    logging: true,
    //synchronize: true,
    migrations: [path.join(__dirname, './migrations/*')],
    entities: [User, Constituency, PreActivatedUser],
  });

  await connection.runMigrations();

  const app = express();

  const RedisStore = connectRedis(session);
  const redis = new Redis(process.env.REDIS_URL);

  app.set('trust proxy', 1);

  app.use(
    cors({
      origin: process.env.CORS_ORIGIN,
      credentials: true,
    })
  );

  app.use(
    session({
      store: new RedisStore({
        client: redis,
        disableTouch: true,
      }),
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 365,
        httpOnly: true,
        secure: __prod__,
        sameSite: 'lax',
        domain: __prod__ ? '.myedudomain.com' : undefined,
      },
      secret: process.env.SESSION_SECRET,
      name: COOKIE_NAME,
      resave: false,
      saveUninitialized: false,
    })
  );

  const apolloServer = new ApolloServer({
    schema: await buildSchema({
      resolvers: [UserResolver, AdminResolver, ConstituencyResolver],
      validate: false,
    }),
    context: ({ req, res }) => ({ req, res, redis }),
  });

  apolloServer.applyMiddleware({ app, cors: false });

  app.listen(parseInt(process.env.PORT), () => {
    console.log('Server is running');
  });
})();
