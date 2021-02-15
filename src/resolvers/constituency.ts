import { Constituency } from '../entities/Constituency';
import { havePrivilages } from '../middleware/havePrivilages';
import { isAuth } from '../middleware/isAuth';
import { Arg, Ctx, Field, Int, Mutation, ObjectType, Query, Resolver, UseMiddleware } from 'type-graphql';
import { getConnection } from 'typeorm';
import { User } from '../entities/User';
import { FieldError } from './user';
import { MyContext } from '../types';

@ObjectType()
class ConstituencyResponse {
  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];

  @Field(() => String, { nullable: true })
  error?: string;

  @Field(() => Constituency, { nullable: true })
  constituency?: Constituency;
}

@ObjectType()
class ReportResponse {
  @Field(() => String, { nullable: true })
  report: string;

  @Field(() => String)
  adress: string;

  @Field(() => Int)
  id: number;
}

@Resolver()
export class ConstituencyResolver {
  @Query(() => [Constituency], { nullable: true })
  @UseMiddleware(isAuth)
  @UseMiddleware(havePrivilages)
  async getListOfConstituencies(): Promise<Constituency[] | null> {
    const constituencies = await Constituency.find({ order: { id: 'ASC' } });

    const getUserData = constituencies
      .map((constituency, index) => (constituency.operatorId ? { id: constituency.id, index } : null))
      .filter((constituency) => constituency);

    let constituenciesWithUser: Constituency[];
    if (getUserData) {
      constituenciesWithUser = await getConnection().query(
        // `select c.* from public.constituency c
        // order by c."id" ASC`
        `
          select c.*, json_build_object('id', u.id, 'username', u.username, 'firstName', u."firstName", 'lastName', u."lastName") "operator" from constituency c
          inner join public.user u on u.id = c."operatorId"
          order by c."id" DESC
        `
      );

      constituenciesWithUser.forEach((constituency) => {
        const findUserData = getUserData.find((userData) => userData!.id === constituency.id);
        if (findUserData) constituencies[findUserData.index] = constituency;
      });
    }

    return constituencies;
  }

  @Mutation(() => ConstituencyResponse)
  @UseMiddleware(isAuth)
  @UseMiddleware(havePrivilages)
  async createNewConstituency(
    @Arg('id', () => Int) id: number,
    @Arg('electorate', () => Int) electorate: number,
    @Arg('adress') adress: string
  ): Promise<ConstituencyResponse> {
    if (!id) {
      return { errors: [{ field: 'constituencyId', message: "This field can't be empty." }] };
    }
    if (electorate <= 0)
      return {
        errors: [{ field: 'electorate', message: "There isn't a constituency with lower electorate than 0." }],
      };
    else if (electorate > 100000)
      return {
        errors: [{ field: 'electorate', message: "There isn't a constituency with higher electorate than 100000." }],
      };

    const alreadyExist = await Constituency.findOne(id);
    if (alreadyExist) {
      return { errors: [{ field: 'constituencyId', message: 'This id already is taken.' }] };
    }

    let constituency;
    try {
      const results = await getConnection()
        .createQueryBuilder()
        .insert()
        .into(Constituency)
        .values({ id, adress, electorate })
        .returning('*')
        .execute();

      constituency = results.raw[0];
    } catch (err) {
      throw new Error(`${err.message}`);
    }

    return { constituency };
  }

  @Mutation(() => Boolean)
  @UseMiddleware(isAuth)
  @UseMiddleware(havePrivilages)
  async deleteConstituency(@Arg('id', () => Int) id: number): Promise<Boolean> {
    const constituency = await Constituency.findOne({ id });

    if (constituency) {
      const connectedOperator = await User.findOne({ id: constituency.operatorId });

      if (connectedOperator) {
        const allConstituenciesIds = connectedOperator?.constituenciesIds.split(', ');
        const constituenciesIdsCorrected = allConstituenciesIds
          .filter((constituenciesIds) => constituenciesIds !== id.toString())
          .join(', ');

        await User.update(
          { id: constituency.operatorId },
          {
            constituenciesIds: constituenciesIdsCorrected,
          }
        );
      }

      const response = await Constituency.delete({ id });

      return !!response.affected;
    }

    return false;
  }

  @Mutation(() => ConstituencyResponse)
  @UseMiddleware(isAuth)
  @UseMiddleware(havePrivilages)
  async assignOperator(
    @Arg('constituencyId', () => Int) constituencyId: number,
    @Arg('userId', () => Int) userId: number
  ): Promise<ConstituencyResponse> {
    if (userId === 1) {
      throw new Error('Wrong assignment.');
    }

    const user = await User.findOne(userId);
    if (!user) {
      throw new Error("User doesn't exist.");
    }

    const operator = await Constituency.findOne({ where: { id: constituencyId, operatorId: userId } });
    if (operator) {
      throw new Error('User already assigned to this constituency.');
    }

    let constituency;
    try {
      const results = await getConnection()
        .createQueryBuilder()
        .update(Constituency)
        .set({ operatorId: userId })
        .where('id = :id', { id: constituencyId })
        .returning('*')
        .execute();

      constituency = results.raw[0];

      const constituenciesIds = user.constituenciesIds
        ? user.constituenciesIds + `, ${constituencyId}`
        : `${constituencyId}`;

      await User.update(
        { id: constituency.operatorId },
        {
          constituenciesIds,
        }
      );
    } catch (err) {
      throw new Error(err.message);
    }

    return { constituency };
  }

  @Mutation(() => ConstituencyResponse)
  @UseMiddleware(isAuth)
  @UseMiddleware(havePrivilages)
  async clearAssignedOperator(@Arg('constituencyId', () => Int) constituencyId: number): Promise<ConstituencyResponse> {
    const constituency = await Constituency.findOne({ id: constituencyId });

    if (!constituency) {
      throw new Error("Constituency doesn't exist.");
    }

    const user = await User.findOne({ id: constituency.operatorId });
    if (!user) {
      throw new Error("User doesn't exist.");
    }

    const allConstituenciesIds = user?.constituenciesIds.split(', ');
    const constituenciesIdsCorrected = allConstituenciesIds
      .filter((constituenciesIds) => constituenciesIds !== constituencyId.toString())
      .join(', ');

    try {
      await User.update(
        { id: constituency.operatorId },
        {
          constituenciesIds: constituenciesIdsCorrected,
        }
      );

      await Constituency.update(
        { id: constituencyId },
        {
          operatorId: undefined,
        }
      );
    } catch (err) {
      throw new Error(err.message);
    }

    return { constituency };
  }

  @Mutation(() => ConstituencyResponse)
  @UseMiddleware(isAuth)
  @UseMiddleware(havePrivilages)
  async changeConstituencyInfo(
    @Arg('constituencyId', () => Int) constituencyId: number,
    @Arg('newAdress') newAdress: string,
    @Arg('electorate', () => Int) electorate: number
  ): Promise<ConstituencyResponse> {
    let constituency;

    if (electorate <= 0)
      return {
        errors: [{ field: 'electorate', message: "There isn't a constituency with lower electorate than 0." }],
      };
    else if (electorate > 100000)
      return {
        errors: [{ field: 'electorate', message: "There isn't a constituency with higher electorate than 100000." }],
      };
    else if (!Number.isInteger(electorate)) {
      return {
        errors: [{ field: 'electorate', message: 'Only numbers without decimals are accepted.' }],
      };
    }

    try {
      const results = await getConnection()
        .createQueryBuilder()
        .update(Constituency)
        .set({ adress: newAdress, electorate })
        .where('id = :id', { id: constituencyId })
        .returning('*')
        .execute();

      constituency = results.raw[0];
    } catch (err) {
      throw new Error(err.message);
    }

    return { constituency };
  }

  @Query(() => [Constituency], { nullable: true })
  @UseMiddleware(isAuth)
  getConstituency(@Ctx() { req }: MyContext): Promise<Constituency[] | undefined> {
    return Constituency.find({ where: { operatorId: req.session.userId }, order: { id: 'ASC' } });
  }

  @Mutation(() => ConstituencyResponse, { nullable: true })
  @UseMiddleware(isAuth)
  async updateVoters(
    @Arg('constituencyId', () => Int) constituencyId: number,
    @Arg('voters', () => Int) voters: number,
    @Arg('timeAt', () => Int) timeAt: number,
    @Ctx() { req }: MyContext
  ): Promise<ConstituencyResponse> {
    const user = await User.findOne(req.session.userId);
    if (!user) {
      return { error: 'Session inactive. Log in again.' };
    }

    const constituency = await Constituency.findOne({ where: { id: constituencyId, operatorId: req.session.userId } });
    if (!constituency) {
      return { error: 'Constituency not found.' };
    }

    if (voters <= 0) {
      return { error: "Number of voters can't be lower than 1." };
    } else if (voters > constituency.electorate) {
      return { error: "Number of voters can't be higher that electorate." };
    }

    if (timeAt === 14) {
      await Constituency.update(
        { id: constituencyId, operatorId: req.session.userId },
        {
          votersAt14: voters,
        }
      );
      constituency.votersAt14 = voters;
    } else {
      await Constituency.update(
        { id: constituencyId, operatorId: req.session.userId },
        {
          votersAt17: voters,
        }
      );
      constituency.votersAt17 = voters;
    }

    return { constituency };
  }

  @Mutation(() => ConstituencyResponse, { nullable: true })
  @UseMiddleware(isAuth)
  async updateCardVoters(
    @Arg('constituencyId', () => Int) constituencyId: number,
    @Arg('cardVoters', () => Int) cardVoters: number,
    @Arg('timeAt', () => Int) timeAt: number,
    @Ctx() { req }: MyContext
  ): Promise<ConstituencyResponse> {
    const user = await User.findOne(req.session.userId);
    if (!user) {
      return { error: 'Session inactive. Log in again.' };
    }

    const constituency = await Constituency.findOne({ where: { id: constituencyId, operatorId: req.session.userId } });
    if (!constituency) {
      return { error: 'Constituency not found.' };
    }

    if (cardVoters <= 0) {
      return { error: "Number of voters can't be lower than 1." };
    }
    if (timeAt === 14) {
      if (cardVoters > constituency.votersAt14)
        return { error: "Number of voters who got vote card can't be higher that voters." };

      await Constituency.update(
        { id: constituencyId, operatorId: req.session.userId },
        {
          cardVotersAt14: cardVoters,
        }
      );
      constituency.cardVotersAt14 = cardVoters;
    } else {
      if (cardVoters > constituency.votersAt17)
        return { error: "Number of voters who got vote card can't be higher that voters." };

      await Constituency.update(
        { id: constituencyId, operatorId: req.session.userId },
        {
          cardVotersAt17: cardVoters,
        }
      );
      constituency.cardVotersAt17 = cardVoters;
    }

    return { constituency };
  }

  @Query(() => [ReportResponse], { nullable: true })
  @UseMiddleware(isAuth)
  async getReports(
    @Ctx() { req }: MyContext,
    @Arg('operatorId', () => Int, { defaultValue: -1 }) operatorId?: number
  ): Promise<ReportResponse[] | undefined> {
    let constituencies: Constituency[] = [];

    if (operatorId === -1 && req.session.priv && req.session.priv === 'full') {
      constituencies = await Constituency.find({ order: { id: 'ASC' } });

      return constituencies.map((c) => {
        return { id: c.id, adress: c.adress, report: c.finalReport };
      });
    }

    if (operatorId === -1) {
      return undefined;
    }

    constituencies = await Constituency.find({ where: { operatorId: operatorId }, order: { id: 'ASC' } });

    if (constituencies.length === 0) {
      return undefined;
    }

    return constituencies.map((c) => {
      return { id: c.id, adress: c.adress, report: c.finalReport };
    });
  }

  @Mutation(() => ConstituencyResponse, { nullable: true })
  @UseMiddleware(isAuth)
  async saveProtocol(
    @Arg('constituencyId', () => Int) constituencyId: number,
    @Arg('finalReport', () => String) finalReport: string,
    @Ctx() { req }: MyContext
  ): Promise<ConstituencyResponse> {
    const user = await User.findOne(req.session.userId);
    if (!user) {
      return { error: 'Session inactive. Log in again.' };
    }

    const constituency = await Constituency.findOne({ where: { id: constituencyId, operatorId: req.session.userId } });
    if (!constituency) {
      return { error: 'Constituency not found.' };
    }

    await Constituency.update(
      { id: constituencyId, operatorId: req.session.userId },
      {
        finalReport: finalReport,
      }
    );

    return { constituency };
  }

  @Mutation(() => ConstituencyResponse, { nullable: true })
  @UseMiddleware(isAuth)
  async deleteProtocol(
    @Arg('constituencyId', () => Int) constituencyId: number,
    @Ctx() { req }: MyContext
  ): Promise<ConstituencyResponse> {
    const user = await User.findOne(req.session.userId);
    if (!user) {
      return { error: 'Session inactive. Log in again.' };
    }

    const constituency = await Constituency.findOne({ where: { id: constituencyId, operatorId: req.session.userId } });
    if (!constituency) {
      return { error: 'Constituency not found.' };
    }

    if (constituency.finalReport) {
      await Constituency.update(
        { id: constituencyId, operatorId: req.session.userId },
        {
          finalReport: '',
        }
      );
    }

    return { constituency };
  }
}
