import { MiddlewareFn } from 'type-graphql';
import { MyContext } from '../types';

export const havePrivilages: MiddlewareFn<MyContext> = ({ context }, next) => {
  const { priv } = context.req.session;
  if (!priv || priv !== 'full') {
    throw new Error('access denied');
  }

  return next();
};
