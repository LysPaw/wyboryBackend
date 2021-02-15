import { Arg, Ctx, Field, Int, Mutation, ObjectType, Query, Resolver, UseMiddleware } from 'type-graphql';
import { getConnection } from 'typeorm';
import { User } from '../entities/User';
//import { Constituency } from '../entities/Constituency';
import { PreActivatedUser } from '../entities/PreActivatedUser';
import { MyContext } from '../types';
import { v4 } from 'uuid';
import { isAuth } from '../middleware/isAuth';
import { havePrivilages } from '../middleware/havePrivilages';
import { FieldError } from './user';
import { loginFieldValidation } from '../utils/loginFieldValidations';
import { contactFieldValidation } from '../utils/contactFieldValidation';
import { FORGET_PASSWORD_PREFIX } from '../constants';
import { Constituency } from '../entities/Constituency';

@ObjectType()
class AdminResponse {
  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];

  @Field(() => PreActivatedUser, { nullable: true })
  preActiveUser?: PreActivatedUser;
}

@ObjectType()
class AllUsers {
  @Field(() => [User], { nullable: true })
  users?: User[];

  @Field(() => [PreActivatedUser], { nullable: true })
  unregisteredUsers?: PreActivatedUser[];
}

@Resolver()
export class AdminResolver {
  @Mutation(() => AdminResponse)
  @UseMiddleware(isAuth)
  @UseMiddleware(havePrivilages)
  async createNewUser(
    @Arg('username') username: string,
    @Arg('firstName') firstName: string,
    @Arg('secondName', { defaultValue: '' }) secondName: string,
    @Arg('lastName') lastName: string,
    @Arg('phoneNumber', { defaultValue: '' }) phoneNumber: string,
    @Arg('emailAdress', { defaultValue: '' }) emailAdress: string
  ): Promise<AdminResponse> {
    const validateResponse = loginFieldValidation(username, null);
    if (validateResponse) {
      return { errors: validateResponse };
    }
    if (!firstName) {
      return {
        errors: [{ field: 'firstName', message: 'Name is required.' }],
      };
    }
    if (!lastName) {
      return {
        errors: [{ field: 'lastName', message: 'Name is required.' }],
      };
    }
    if (phoneNumber) {
      const validatePhoneNumber = contactFieldValidation(phoneNumber, null);
      if (validatePhoneNumber) {
        return validatePhoneNumber;
      }
    }
    if (emailAdress) {
      const validateEmailAdress = contactFieldValidation(null, emailAdress);
      if (validateEmailAdress) {
        return validateEmailAdress;
      }
    }

    const checkUniqueUsername = await User.findOne({ where: { username } });
    // to avoid duplicates in User table
    if (checkUniqueUsername) {
      return {
        errors: [{ field: 'username', message: 'Username is already taken.' }],
      };
    }

    const token = v4().split('-')[0];

    let createNewUser;
    try {
      const result = await getConnection()
        .createQueryBuilder()
        .insert()
        .into(PreActivatedUser)
        .values({
          username,
          firstName,
          secondName,
          lastName,
          phoneNumber,
          emailAdress,
          activationCode: token,
        })
        .returning('*')
        .execute();

      createNewUser = result.raw[0];
    } catch (err) {
      if (err.detail.includes('(username)=(')) {
        return {
          errors: [{ field: 'username', message: 'Username is already taken.' }],
        };
      } else if (err.detail.includes('(activationCode)=(')) {
        return {
          errors: [
            {
              field: 'activationCode',
              message:
                "Generated token was duplicated. It's a very rare situation, just submit form again and it should disappear.",
            },
          ],
        };
      } else {
        throw new Error(err.message);
      }
    }

    return {
      preActiveUser: createNewUser,
    };
  }

  @Query(() => AllUsers, { nullable: true })
  @UseMiddleware(isAuth)
  @UseMiddleware(havePrivilages)
  async getListOfUser(): Promise<AllUsers> {
    const users = await User.find({ order: { id: 'ASC' }, skip: 1 });
    const unregisteredUsers = await PreActivatedUser.find({ order: { id: 'ASC' } });

    return { users, unregisteredUsers };
  }

  @Mutation(() => User, { nullable: true })
  @UseMiddleware(isAuth)
  @UseMiddleware(havePrivilages)
  async changeUserInfoData(
    @Arg('userType') userType: boolean,
    @Arg('id', () => Int) id: number,
    @Arg('username') username: string,
    @Arg('firstName') firstName: string,
    @Arg('secondName', { defaultValue: '' }) secondName: string,
    @Arg('lastName') lastName: string,
    @Arg('phoneNumber', { defaultValue: '' }) phoneNumber: string,
    @Arg('emailAdress', { defaultValue: '' }) emailAdress: string
  ): Promise<User | null> {
    if (userType === undefined || !id || !firstName || !lastName) {
      throw new Error('invalid values');
    }
    const parameters = [
      { name: 'firstName', value: firstName },
      { name: 'secondName', value: secondName },
      { name: 'lastName', value: lastName },
      { name: 'phoneNumber', value: phoneNumber },
      { name: 'emailAdress', value: emailAdress },
    ].filter((obj) => obj.value);

    const stringsInsideQuery = parameters.map((obj, index) => `"${obj.name}" = $${index + 1}, `).join('');
    const argForQuery = parameters.map((obj) => obj.value);

    const result = await getConnection().query(
      `
        UPDATE ${userType ? '"user"' : '"pre_activated_user"'}
        SET ${stringsInsideQuery}
        "updatedAt" = CURRENT_TIMESTAMP
        WHERE "id" = $${parameters.length + 1} and "username" = $${parameters.length + 2} RETURNING *
      `,
      [...argForQuery, id, username]
    );
    return result[0][0];
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  @UseMiddleware(havePrivilages)
  async deleteUser(
    @Arg('userType') userType: boolean,
    @Arg('username') username: string,
    @Arg('id', () => Int) id: number
  ): Promise<boolean> {
    if (userType) {
      const connectedConstituencies = await Constituency.find({ operatorId: id });
      if (connectedConstituencies) {
        connectedConstituencies.forEach(async (consituency) => {
          const { id } = consituency;
          await getConnection()
            .createQueryBuilder()
            .update(Constituency)
            .set({
              operatorId: undefined,
            })
            .where('id = :id', { id })
            .execute();
        });
      }
    }
    //clean operatorId in Constituency if found one

    const response = userType ? await User.delete({ id, username }) : await PreActivatedUser.delete({ id, username });

    return !!response.affected;
  }

  @Query(() => User, { nullable: true })
  @UseMiddleware(isAuth)
  @UseMiddleware(havePrivilages)
  getUser(@Arg('userId') userId: number): Promise<User | undefined> {
    return User.findOne(userId);
  }

  @Mutation(() => String)
  @UseMiddleware(isAuth)
  @UseMiddleware(havePrivilages)
  async resetPassword(@Arg('username') username: string, @Ctx() { redis }: MyContext): Promise<string> {
    const user = await User.findOne({ where: { username } });
    if (!user) {
      return '';
    }

    const token = v4();

    await redis.set(FORGET_PASSWORD_PREFIX + token, user.id, 'ex', 1000 * 60 * 60 * 24 * 2); // after 2 days token expire

    return `http://localhost:3000/change-password/${token}`;
  }
}
