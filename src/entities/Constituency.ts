import { Field, ObjectType, Int } from 'type-graphql';
import { BaseEntity, Column, CreateDateColumn, Entity, ManyToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { User } from './User';

@ObjectType()
@Entity()
export class Constituency extends BaseEntity {
  @Field(() => Int)
  @PrimaryColumn({ unique: true })
  id!: number;

  @Field()
  @Column()
  adress: string;

  @Field(() => Int)
  @Column()
  electorate: number;

  @Field(() => Int, { nullable: true })
  @Column({ nullable: true })
  votersAt14: number;

  @Field(() => Int, { nullable: true })
  @Column({ nullable: true })
  cardVotersAt14: number;

  @Field(() => Int, { nullable: true })
  @Column({ nullable: true })
  votersAt17: number;

  @Field(() => Int, { nullable: true })
  @Column({ nullable: true })
  cardVotersAt17: number;

  @Field(() => String, { nullable: true })
  @Column({ nullable: true })
  finalReport: string;

  @Column({ nullable: true })
  operatorId: number;

  @Field(() => User, { nullable: true })
  @ManyToOne(() => User, (operators) => operators.constituencies)
  operator: User;

  @Field(() => String)
  @CreateDateColumn()
  createdAt: Date;

  @Field(() => String)
  @UpdateDateColumn()
  updatedAt: Date;
}
