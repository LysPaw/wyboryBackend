import { Field, Int, ObjectType } from 'type-graphql';
import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Constituency } from './Constituency';

@ObjectType()
@Entity()
export class User extends BaseEntity {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  id!: number;

  @Field(() => String)
  @Column({ unique: true })
  username!: string;

  @Column()
  password!: string;

  @Field(() => String)
  @Column()
  firstName: string;

  @Field(() => String)
  @Column()
  secondName: string;

  @Field(() => String)
  @Column()
  lastName: string;

  @Field(() => String)
  @Column()
  phoneNumber: string;

  @Field(() => String)
  @Column()
  emailAdress: string;

  @Field(() => String)
  @CreateDateColumn()
  createdAt: Date;

  @Field(() => String)
  @UpdateDateColumn()
  updatedAt: Date;

  @Field(() => String, { nullable: true })
  @Column({ nullable: true })
  constituenciesIds: string;

  //@Field(() => Constituency, { nullable: true })
  @OneToMany(() => Constituency, (constituency) => constituency.operator)
  constituencies: Constituency[];

  @Column({ nullable: true })
  access: string;
}
