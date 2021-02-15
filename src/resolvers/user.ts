import { User } from '../entities/User';
import { PreActivatedUser } from '../entities/PreActivatedUser';
import { Arg, Ctx, Field, Mutation, ObjectType, Query, Resolver, UseMiddleware } from 'type-graphql';
import { MyContext } from '../types';
import { getConnection } from 'typeorm';
import argon2 from 'argon2';
import { loginFieldValidation } from '../utils/loginFieldValidations';
import { COOKIE_NAME, FORGET_PASSWORD_PREFIX } from '../constants';
import { isAuth } from '../middleware/isAuth';
import { contactFieldValidation } from '../utils/contactFieldValidation';

@ObjectType()
export class FieldError {
  @Field()
  field: string;

  @Field()
  message: string;
}

@ObjectType()
class UserResponse {
  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];

  @Field(() => User, { nullable: true })
  user?: User;
}

@Resolver()
export class UserResolver {
  @Query(() => User, { nullable: true })
  me(@Ctx() { req }: MyContext): Promise<User | undefined> | null {
    if (!req.session.userId) {
      return null;
    }

    return User.findOne(req.session.userId);
  }

  @Mutation(() => UserResponse)
  async login(
    @Arg('username') username: string,
    @Arg('password') password: string,
    @Arg('privilages', { defaultValue: false }) privilages: boolean = false,
    @Ctx() { req }: MyContext
  ): Promise<UserResponse> {
    if (!privilages) {
      const validationResponse = loginFieldValidation(username, password);
      if (validationResponse) {
        return { errors: validationResponse };
      }
    }

    const user = await User.findOne({ where: { username } });

    if (!user) {
      return {
        errors: [
          {
            field: 'username',
            message: 'Incorrect username.',
          },
        ],
      };
    }

    const validatePassword = await argon2.verify(user.password, password);

    if (!validatePassword) {
      return {
        errors: [
          {
            field: 'password',
            message: 'Incorrect password.',
          },
        ],
      };
    }

    if (privilages) {
      if (user.access === 'admin_privileges') {
        req.session.priv = 'full';
      } else {
        return new Error('access denied') as UserResponse;
      }
    }

    req.session.userId = user.id;
    // req.session.userId = '1'; //zalogowani jako admin
    // req.session.priv = 'full'; //zalogowani jako admin

    return { user };
  }

  @Mutation(() => Boolean)
  logout(@Ctx() { req, res }: MyContext) {
    return new Promise((resolve) =>
      req.session.destroy((err) => {
        res.clearCookie(COOKIE_NAME);
        if (err) {
          resolve(false);
          return;
        }

        resolve(true);
      })
    );
  }

  @Mutation(() => UserResponse)
  async register(
    @Arg('username') username: string,
    @Arg('activationCode') activationCode: string,
    @Arg('password') password: string,
    @Ctx() { req }: MyContext
  ): Promise<UserResponse> {
    const validationResponse = loginFieldValidation(username, password, activationCode);
    if (validationResponse) {
      return {
        errors: validationResponse,
      };
    }

    const newUser = await PreActivatedUser.findOne({ where: { username, activationCode } });
    if (!newUser) {
      const typeOfError = await PreActivatedUser.findOne({ where: { username } });
      if (!typeOfError) {
        return {
          errors: [
            {
              field: 'username',
              message: 'Incorrect username.',
            },
          ],
        };
      } else {
        return {
          errors: [
            {
              field: 'activationCode',
              message: 'Incorrect code.',
            },
          ],
        };
      }
    }

    const { firstName, secondName, lastName, phoneNumber, emailAdress } = newUser;
    const hashedPassword = await argon2.hash(password);
    let user: User;
    try {
      const result = await getConnection()
        .createQueryBuilder()
        .insert()
        .into(User)
        .values({
          username: username,
          password: hashedPassword,
          firstName,
          secondName,
          lastName,
          phoneNumber,
          emailAdress,
        })
        .returning('*')
        .execute();

      user = result.raw[0];

      await PreActivatedUser.delete({ username });
    } catch (err) {
      throw new Error(err.message);
    }

    req.session.userId = user.id;

    return { user };
  }

  @Mutation(() => UserResponse)
  async changePasswordWithToken(
    @Arg('token') token: string,
    @Arg('newPassword') newPassword: string,
    @Ctx() { req, redis }: MyContext
  ): Promise<UserResponse> {
    const validationResponse = loginFieldValidation(null, newPassword);
    if (validationResponse) {
      return {
        errors: validationResponse,
      };
    }

    const key = FORGET_PASSWORD_PREFIX + token;
    const userId = await redis.get(key);
    if (!userId) {
      return {
        errors: [
          {
            field: 'token',
            message: 'Token expired.',
          },
        ],
      };
    }

    const userIdNum = parseInt(userId);
    const user = await User.findOne(userIdNum);
    if (!user) {
      return {
        errors: [
          {
            field: 'token',
            message: 'User no longer exist.',
          },
        ],
      };
    }

    await User.update({ id: userIdNum }, { password: await argon2.hash(newPassword) });

    await redis.del(key);

    req.session.userId = user.id;

    return { user };
  }

  @Mutation(() => UserResponse)
  @UseMiddleware(isAuth)
  async changePassword(
    @Arg('oldPassword') oldPassword: string,
    @Arg('newPassword') newPassword: string,
    @Ctx() { req }: MyContext
  ): Promise<UserResponse> {
    if (oldPassword === newPassword) {
      return {
        errors: [
          {
            field: 'newPassword',
            message: "Passwords can't be indentical.",
          },
        ],
      };
    }
    const validationResponseNewPassword = loginFieldValidation(null, newPassword);
    if (validationResponseNewPassword) {
      return {
        errors: [
          {
            field: 'newPassword',
            message: validationResponseNewPassword[0].message,
          },
        ],
      };
    }
    const validationResponseOldPassword = loginFieldValidation(null, oldPassword);
    if (validationResponseOldPassword) {
      return {
        errors: [
          {
            field: 'oldPassword',
            message: validationResponseOldPassword[0].message,
          },
        ],
      };
    }

    const user = await User.findOne(req.session.userId);
    if (!user) {
      throw new Error("User doesn't exist.");
    }

    const validatePassword = await argon2.verify(user.password, oldPassword);

    if (!validatePassword) {
      return {
        errors: [
          {
            field: 'oldPassword',
            message: 'Incorrect password.',
          },
        ],
      };
    }

    await User.update({ id: req.session.userId }, { password: await argon2.hash(newPassword) });

    return { user };
  }

  @Mutation(() => UserResponse)
  @UseMiddleware(isAuth)
  async changeContactInfo(
    @Arg('phoneNumber', { defaultValue: '' }) phoneNumber: string,
    @Arg('emailAdress', { defaultValue: '' }) emailAdress: string,
    @Ctx() { req }: MyContext
  ): Promise<UserResponse> {
    if (phoneNumber === '' && emailAdress === '') {
      return {
        errors: [
          {
            field: 'emailAdress',
            message: 'At least one input must be filled.',
          },
        ],
      };
    }

    const contactValidation = contactFieldValidation(phoneNumber, emailAdress);
    if (contactValidation) {
      return contactValidation;
    }

    const user = await User.findOne(req.session.userId);
    if (!user) {
      throw new Error("User doesn't exist.");
    }

    if (phoneNumber !== '' && emailAdress !== '') {
      await User.update({ id: req.session.userId }, { phoneNumber, emailAdress });
      user.phoneNumber = phoneNumber;
      user.emailAdress = emailAdress;
    } else if (phoneNumber !== '') {
      await User.update({ id: req.session.userId }, { phoneNumber });
      user.phoneNumber = phoneNumber;
    } else if (emailAdress !== '') {
      await User.update({ id: req.session.userId }, { emailAdress });
      user.emailAdress = emailAdress;
    }

    return { user };
  }
}
