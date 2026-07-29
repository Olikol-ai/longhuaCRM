import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../../modules/auth/auth.service';
import { normalizeUserRole } from '../../modules/auth/onboarding';
import { UsersRepository } from '../users/users.repository';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly usersRepository: UsersRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: { headers?: Record<string, string> }) => req.headers?.['x-access-token'] ?? null,
        // Allows <img src="...?access_token="> for authenticated avatar streams.
        ExtractJwt.fromUrlQueryParameter('access_token'),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.secret') ?? 'longhua-dev-secret-change-in-production',
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const row = await this.usersRepository.findById(payload.sub);
    if (!row) {
      throw new UnauthorizedException('User not found');
    }

    if (row.status === 'blocked') {
      throw new UnauthorizedException('Account is blocked');
    }

    const role = normalizeUserRole(row.role);

    return {
      sub: row.id,
      email: row.email,
      role: role ?? '',
    };
  }
}
