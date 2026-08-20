import { Module } from '@nestjs/common';

import { JwtModule } from '@nestjs/jwt';

import { ConfigService } from '@nestjs/config';

import { PassportModule } from '@nestjs/passport';

import { TypeOrmModule } from '@nestjs/typeorm';

import { PendingRegistrationEntity } from './entities/pending-registration.entity';

import { UsersModule } from '../users/users.module';

import { MailModule } from '../mail/mail.module';

import { TeachersModule } from '../teachers/teachers.module';

import { TutorsModule } from '../tutors/tutors.module';

import { AuthController } from './auth.controller';

import { AuthService } from './auth.service';

import { PendingRegistrationCleanupService } from './pending-registration-cleanup.service';
import { PendingRegistrationRepository } from './pending-registration.repository';

import { PendingRegistrationService } from './pending-registration.service';

import { VerificationEmailService } from './verification-email.service';

import { JwtStrategy } from './jwt.strategy';
import { resolveJwtSecret } from '../../config/jwt-secret.util';



@Module({

  imports: [

    PassportModule.register({ defaultStrategy: 'jwt' }),

    JwtModule.registerAsync({

      inject: [ConfigService],

      useFactory: (config: ConfigService) => ({

        secret: resolveJwtSecret(config),

        signOptions: {

          expiresIn: (config.get<string>('jwt.expiresIn') ?? '7d') as `${number}${'s' | 'm' | 'h' | 'd'}`,

        },

      }),

    }),

    TypeOrmModule.forFeature([PendingRegistrationEntity]),

    UsersModule,

    MailModule,

    TeachersModule,

    TutorsModule,

  ],

  controllers: [AuthController],

  providers: [

    AuthService,

    PendingRegistrationRepository,

    PendingRegistrationService,

    PendingRegistrationCleanupService,

    VerificationEmailService,

    JwtStrategy,

  ],

  exports: [AuthService, PendingRegistrationCleanupService, JwtModule],

})

export class AuthModule {}


