import { Field, Int, ObjectType } from 'type-graphql';
import { BaseEntity, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@ObjectType()
@Entity()
export class PreActivatedUser extends BaseEntity {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  id!: number;

  @Field(() => String)
  @Column({ unique: true })
  username!: string;

  @Field(() => String)
  @Column({ unique: true })
  activationCode!: string;

  @Field(() => String)
  @Column({ nullable: true })
  firstName: string;

  @Field(() => String)
  @Column({ nullable: true })
  secondName: string;

  @Field(() => String)
  @Column({ nullable: true })
  lastName: string;

  @Field(() => String)
  @Column({ nullable: true })
  phoneNumber: string;

  @Field(() => String)
  @Column({ nullable: true })
  emailAdress: string;

  @Field(() => String)
  @CreateDateColumn()
  createdAt: Date;

  @Field(() => String)
  @UpdateDateColumn()
  updatedAt: Date;
}
