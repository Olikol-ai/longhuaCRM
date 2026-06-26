import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { JwtPayload } from '../../modules/auth/auth.service';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: JwtPayload | null }>();
    if (!request.user || request.user.role !== 'admin') {
      throw new ForbiddenException('Forbidden: Admin access required');
    }
    return true;
  }
}
