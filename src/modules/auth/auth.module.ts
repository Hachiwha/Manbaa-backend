import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationMember } from '../organizations/entities/organization-member.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginHistory } from './entities/login-history.entity';
import { Organization } from './entities/organization.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { User } from './entities/user.entity';
import { JwtAccessStrategy } from './jwt-access.strategy';
import { PasswordService } from './password.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Organization, OrganizationMember, RefreshToken, LoginHistory]),
    JwtModule.registerAsync({ inject: [ConfigService], useFactory: (config: ConfigService) => ({ secret: config.getOrThrow('jwt.accessSecret') }) }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, JwtAccessStrategy],
  exports: [AuthService, PasswordService, JwtModule],
})
export class AuthModule {}
