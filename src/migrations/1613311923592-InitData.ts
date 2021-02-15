import {MigrationInterface, QueryRunner} from "typeorm";

export class InitData1613311923592 implements MigrationInterface {
    name = 'InitData1613311923592'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "user" ("id" SERIAL NOT NULL, "username" character varying NOT NULL, "password" character varying NOT NULL, "firstName" character varying NOT NULL, "secondName" character varying NOT NULL, "lastName" character varying NOT NULL, "phoneNumber" character varying NOT NULL, "emailAdress" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "constituenciesIds" character varying, "access" character varying, CONSTRAINT "UQ_78a916df40e02a9deb1c4b75edb" UNIQUE ("username"), CONSTRAINT "PK_cace4a159ff9f2512dd42373760" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "constituency" ("id" integer NOT NULL, "adress" character varying NOT NULL, "electorate" integer NOT NULL, "votersAt14" integer, "cardVotersAt14" integer, "votersAt17" integer, "cardVotersAt17" integer, "finalReport" character varying, "operatorId" integer, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_2e02bf34c80bf04c684ccb56c02" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "pre_activated_user" ("id" SERIAL NOT NULL, "username" character varying NOT NULL, "activationCode" character varying NOT NULL, "firstName" character varying, "secondName" character varying, "lastName" character varying, "phoneNumber" character varying, "emailAdress" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_88844f063b2f48de10715d291b8" UNIQUE ("username"), CONSTRAINT "UQ_18018d1c881198d0d18b497c0b0" UNIQUE ("activationCode"), CONSTRAINT "PK_84003d9408a7820e7adb2c82e6c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "constituency" ADD CONSTRAINT "FK_232080f8463b238f0d3f40b5c8d" FOREIGN KEY ("operatorId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "constituency" DROP CONSTRAINT "FK_232080f8463b238f0d3f40b5c8d"`);
        await queryRunner.query(`DROP TABLE "pre_activated_user"`);
        await queryRunner.query(`DROP TABLE "constituency"`);
        await queryRunner.query(`DROP TABLE "user"`);
    }

}
