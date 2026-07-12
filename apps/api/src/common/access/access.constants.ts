import { JwtPayload } from '../../modules/auth/auth.service';

export const NO_ACCESS_UUID = '00000000-0000-0000-0000-000000000000';

export const SYSTEM_ACTOR: JwtPayload = {
  sub: NO_ACCESS_UUID,
  email: 'system@internal',
  role: 'admin',
};
