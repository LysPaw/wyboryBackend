import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitDataFill1613311944125 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
        INSERT INTO "user"("username", "password", "firstName", "secondName", "lastName", "phoneNumber", "emailAdress", "createdAt", "updatedAt", "constituenciesIds", "access") 
        VALUES ('Admin', '$argon2i$v=19$m=4096,t=3,p=1$Ngr9f7YPNaHzyN9Ix8GLqg$rJ/tkpAj44Qh8Mf/RwGwrUUeLye/TCKlwPAeu/U7baY', '', '', '', '', '', DEFAULT, DEFAULT, DEFAULT, 'admin_privileges');
        INSERT INTO "user"("username", "password", "firstName", "secondName", "lastName", "phoneNumber", "emailAdress", "createdAt", "updatedAt", "constituenciesIds", "access") 
        VALUES ('CA1234', '$argon2i$v=19$m=4096,t=3,p=1$qtMq7MU8wtDt8lzI9piDXQ$MJHwuy8vcv8opQ6TBs0DvwxS3ivbqzK+M4sSba1r4sg', 'NameTest', 'NdNameTest', 'LastNameTest', '123456789', 'test@test.com', DEFAULT, DEFAULT, DEFAULT, DEFAULT)
            `);
  }

  public async down(_: QueryRunner): Promise<void> {}
}
