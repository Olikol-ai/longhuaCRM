import { Body, Controller, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { JwtPayload } from '../../auth/auth.service';
import { ActivateUserCryptoDto, UpsertUserCryptoDto } from '../dto/chats.dto';
import { E2EE_KDF_SERVER_HOLD, UserCryptoService } from '../services/user-crypto.service';

@Controller('crypto')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CryptoController {
  constructor(private readonly crypto: UserCryptoService) {}

  @Get('me')
  async me(@CurrentUser() actor: JwtPayload) {
    const row = await this.crypto.getMine(actor.sub);
    if (!row) return { configured: false, needsSetup: true };
    return {
      configured: true,
      needsActivation: row.kdf === E2EE_KDF_SERVER_HOLD,
      userId: row.userId,
      publicKey: row.publicKey,
      wrappedPrivateKey: row.wrappedPrivateKey,
      wrapSalt: row.wrapSalt,
      wrapIv: row.wrapIv,
      algorithm: row.algorithm,
      kdf: row.kdf,
      kdfIterations: row.kdfIterations,
      keyVersion: row.keyVersion,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  @Put('me')
  upsert(@CurrentUser() actor: JwtPayload, @Body() dto: UpsertUserCryptoDto) {
    return this.crypto.upsertMine(actor.sub, {
      publicKey: dto.publicKey,
      wrappedPrivateKey: dto.wrappedPrivateKey,
      wrapSalt: dto.wrapSalt,
      wrapIv: dto.wrapIv,
      algorithm: dto.algorithm,
      kdf: dto.kdf,
      kdfIterations: dto.kdfIterations,
      keyVersion: dto.keyVersion,
    });
  }

  /** Re-wrap server-provisioned identity with the account password. */
  @Post('me/activate')
  activate(@CurrentUser() actor: JwtPayload, @Body() dto: ActivateUserCryptoDto) {
    return this.crypto.activateWithPassword(actor.sub, dto.password);
  }

  @Get('users/:userId/public')
  publicKey(@Param('userId') userId: string) {
    return this.crypto.getPublic(userId);
  }
}
