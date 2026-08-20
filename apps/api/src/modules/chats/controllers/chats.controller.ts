import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SkipThrottle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { createReadStream } from 'fs';
import { buildContentDisposition } from '../../../common/http/content-disposition';
import { Request, Response } from 'express';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { JwtPayload } from '../../auth/auth.service';
import { ChatDirectoryQueryDto, CreateBlockDto, CreateCrmCardDto, CreateDirectChatDto, CreateDmRequestDto, CreateGroupChatDto, CreateMessageDto, InviteMembersDto, ListDmRequestsQueryDto, ListMessagesDto, MarkReadDto, UpdateChatMemberPrefsDto, UpdateChatProfileDto, UpdateDmPrivacyDto, UpdateMessageDto, UploadAttachmentDto } from '../dto/chats.dto';
import { ChatAttachmentKind, DirectChatRequestStatus, DmPrivacyPolicy } from '../enums/chat.enums';
import {
  ChatAttachmentsService,
  normalizeChatAttachmentMime,
} from '../services/chat-attachments.service';
import { ChatDirectoryService } from '../services/chat-directory.service';
import { ChatMessagesService } from '../services/chat-messages.service';
import { ChatPrivacyService } from '../../../common/access/chat-privacy.service';
import { ChatsService } from '../services/chats.service';
import { DirectChatRequestService } from '../services/direct-chat-request.service';
import { UserCryptoService } from '../services/user-crypto.service';

@Controller('chats')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ChatsController {
  constructor(
    private readonly chats: ChatsService,
    private readonly messages: ChatMessagesService,
    private readonly attachments: ChatAttachmentsService,
    private readonly directory: ChatDirectoryService,
    private readonly dmRequests: DirectChatRequestService,
    private readonly privacy: ChatPrivacyService,
    private readonly crypto: UserCryptoService,
  ) {}

  @Get()
  list(@CurrentUser() actor: JwtPayload) {
    return this.chats.listChats(actor);
  }

  @Get('unread-count')
  unreadTotal(@CurrentUser() actor: JwtPayload) {
    return this.chats.unreadSummary(actor);
  }

  @Get('directory')
  directorySearch(@CurrentUser() actor: JwtPayload, @Query() query: ChatDirectoryQueryDto) {
    return this.directory.search(actor, query);
  }

  @Patch('profile')
  updateProfile(@CurrentUser() actor: JwtPayload, @Body() dto: UpdateChatProfileDto) {
    return this.chats.updateProfile(actor, dto);
  }

  @Post('groups')
  createGroup(@CurrentUser() actor: JwtPayload, @Body() dto: CreateGroupChatDto) {
    return this.chats.createGroup(actor, dto.title, dto.memberUserIds, dto.description);
  }

  @Post('direct')
  createDirect(@CurrentUser() actor: JwtPayload, @Body() dto: CreateDirectChatDto) {
    return this.chats.createDirect(actor, dto.userId);
  }

  @Post('dm-requests')
  createDmRequest(@CurrentUser() actor: JwtPayload, @Body() dto: CreateDmRequestDto) {
    return this.dmRequests.create(actor, dto.toUserId, dto.message);
  }

  @Get('dm-requests/incoming')
  incomingDm(
    @CurrentUser() actor: JwtPayload,
    @Query() query: ListDmRequestsQueryDto,
  ) {
    return this.dmRequests.listIncoming(
      actor,
      query.status as DirectChatRequestStatus | undefined,
    );
  }

  @Get('dm-requests/outgoing')
  outgoingDm(
    @CurrentUser() actor: JwtPayload,
    @Query() query: ListDmRequestsQueryDto,
  ) {
    return this.dmRequests.listOutgoing(
      actor,
      query.status as DirectChatRequestStatus | undefined,
    );
  }

  @Post('dm-requests/:id/accept')
  acceptDm(@CurrentUser() actor: JwtPayload, @Param('id') id: string) {
    return this.dmRequests.accept(actor, id);
  }

  @Post('dm-requests/:id/decline')
  declineDm(@CurrentUser() actor: JwtPayload, @Param('id') id: string) {
    return this.dmRequests.decline(actor, id);
  }

  @Post('dm-requests/:id/cancel')
  cancelDm(@CurrentUser() actor: JwtPayload, @Param('id') id: string) {
    return this.dmRequests.cancel(actor, id);
  }

  @Get('privacy')
  getPrivacy(@CurrentUser() actor: JwtPayload) {
    return this.privacy.getOrCreateSettings(actor.sub);
  }

  @Patch('privacy')
  updatePrivacy(@CurrentUser() actor: JwtPayload, @Body() dto: UpdateDmPrivacyDto) {
    return this.privacy.updatePolicy(actor, dto.dmPolicy as DmPrivacyPolicy);
  }

  @Get('blocks')
  listBlocks(@CurrentUser() actor: JwtPayload) {
    return this.privacy.listBlocks(actor);
  }

  @Post('blocks')
  block(@CurrentUser() actor: JwtPayload, @Body() dto: CreateBlockDto) {
    return this.privacy.blockUser(actor, dto.blockedUserId);
  }

  @Delete('blocks/:blockedUserId')
  unblock(@CurrentUser() actor: JwtPayload, @Param('blockedUserId') blockedUserId: string) {
    return this.privacy.unblockUser(actor, blockedUserId);
  }

  /**
   * Stream a chat attachment for any member who can read the chat.
   * Supports Range / 206 for HTML media elements. Not owner-only.
   */
  @SkipThrottle()
  @Get('attachments/:attachmentId/download')
  async download(
    @CurrentUser() actor: JwtPayload,
    @Param('attachmentId') attachmentId: string,
    @Query('disposition') dispositionQuery: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const file = await this.attachments.resolveFile(actor, attachmentId);
    const { attachment, absolutePath, size } = file;
    const mime = normalizeChatAttachmentMime(
      attachment.mime,
      attachment.kind,
      attachment.originalFilename,
    );
    const filename = attachment.originalFilename || attachment.storageKey || 'file';
    const forceDownload = dispositionQuery === 'attachment';
    const disposition = forceDownload ? 'attachment' : 'inline';

    // Skip express compression for binary media / Range responses.
    (request as Request & { headers: Record<string, string | undefined> }).headers[
      'x-no-compression'
    ] = '1';

    response.setHeader('Content-Type', mime);
    response.setHeader('Accept-Ranges', 'bytes');
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('Content-Disposition', buildContentDisposition(disposition, filename));

    const range = request.headers.range;
    if (range && /^bytes=/.test(range)) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (match) {
        let start: number;
        let end: number;
        if (match[1] === '' && match[2] !== '') {
          // suffix: bytes=-500
          const suffix = parseInt(match[2], 10);
          start = Math.max(0, size - suffix);
          end = size - 1;
        } else {
          start = match[1] ? parseInt(match[1], 10) : 0;
          end = match[2] ? parseInt(match[2], 10) : size - 1;
        }
        if (Number.isFinite(start) && Number.isFinite(end) && start >= 0 && start <= end && end < size) {
          response.status(206);
          response.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
          response.setHeader('Content-Length', String(end - start + 1));
          createReadStream(absolutePath, { start, end }).pipe(response);
          return;
        }
      }
      response.status(416);
      response.setHeader('Content-Range', `bytes */${size}`);
      response.end();
      return;
    }

    response.setHeader('Content-Length', String(size));
    createReadStream(absolutePath).pipe(response);
  }

  @Patch('messages/:messageId')
  edit(
    @CurrentUser() actor: JwtPayload,
    @Param('messageId') messageId: string,
    @Body() dto: UpdateMessageDto,
  ) {
    return this.messages.editOwn(actor, messageId, {
      body: dto.body,
      ciphertext: dto.ciphertext,
      nonce: dto.nonce,
      algorithm: dto.algorithm,
      keyVersion: dto.keyVersion,
    });
  }

  @Delete('messages/:messageId')
  remove(@CurrentUser() actor: JwtPayload, @Param('messageId') messageId: string) {
    return this.messages.softDelete(actor, messageId);
  }

  @Delete(':chatId/membership')
  hideMembership(@CurrentUser() actor: JwtPayload, @Param('chatId') chatId: string) {
    return this.chats.hideMembership(actor, chatId);
  }

  @Patch(':chatId/member-prefs')
  updateMemberPrefs(
    @CurrentUser() actor: JwtPayload,
    @Param('chatId') chatId: string,
    @Body() dto: UpdateChatMemberPrefsDto,
  ) {
    return this.chats.updateMemberPrefs(actor, chatId, dto);
  }

  @Post(':chatId/archive')
  archiveChat(@CurrentUser() actor: JwtPayload, @Param('chatId') chatId: string) {
    return this.chats.archiveChat(actor, chatId);
  }

  @Post(':chatId/unarchive')
  unarchiveChat(@CurrentUser() actor: JwtPayload, @Param('chatId') chatId: string) {
    return this.chats.unarchiveChat(actor, chatId);
  }

  @Get(':chatId/members')
  members(@CurrentUser() actor: JwtPayload, @Param('chatId') chatId: string) {
    return this.chats.listMembers(actor, chatId);
  }

  @Post(':chatId/members')
  invite(
    @CurrentUser() actor: JwtPayload,
    @Param('chatId') chatId: string,
    @Body() dto: InviteMembersDto,
  ) {
    return this.chats.inviteMembers(actor, chatId, dto.memberUserIds);
  }

  @Get(':chatId/pins')
  pins(@CurrentUser() actor: JwtPayload, @Param('chatId') chatId: string) {
    return this.chats.listPins(actor, chatId);
  }

  @Get(':chatId/unread')
  unread(@CurrentUser() actor: JwtPayload, @Param('chatId') chatId: string) {
    return this.chats.unreadCount(actor, chatId);
  }

  @Patch(':chatId/read')
  markRead(
    @CurrentUser() actor: JwtPayload,
    @Param('chatId') chatId: string,
    @Body() dto: MarkReadDto,
  ) {
    return this.chats.markRead(actor, chatId, dto.messageId ?? null);
  }

  @Post(':chatId/unread')
  markUnread(@CurrentUser() actor: JwtPayload, @Param('chatId') chatId: string) {
    return this.chats.markUnread(actor, chatId);
  }

  @Get(':chatId/messages')
  messagesList(
    @CurrentUser() actor: JwtPayload,
    @Param('chatId') chatId: string,
    @Query() query: ListMessagesDto,
  ) {
    return this.messages.list(actor, chatId, query.limit, query.before);
  }

  @Get(':chatId')
  get(@CurrentUser() actor: JwtPayload, @Param('chatId') chatId: string) {
    return this.chats.getChat(actor, chatId);
  }

  @Get(':chatId/e2ee')
  chatE2ee(@CurrentUser() actor: JwtPayload, @Param('chatId') chatId: string) {
    return this.crypto.getChatE2ee(actor, chatId);
  }

  @Post(':chatId/messages')
  message(
    @CurrentUser() actor: JwtPayload,
    @Param('chatId') chatId: string,
    @Body() dto: CreateMessageDto,
  ) {
    if (dto.ciphertext) {
      if (!dto.nonce || !dto.algorithm || !dto.keyVersion) {
        throw new BadRequestException(
          'Encrypted messages require ciphertext, nonce, algorithm, and keyVersion',
        );
      }
      return this.messages.createEncryptedText(actor, chatId, {
        ciphertext: dto.ciphertext,
        nonce: dto.nonce,
        algorithm: dto.algorithm,
        keyVersion: dto.keyVersion,
        replyToMessageId: dto.replyToMessageId ?? null,
      });
    }
    if (!dto.body) {
      throw new BadRequestException('body is required for non-encrypted messages');
    }
    return this.messages.createText(actor, chatId, dto.body, dto.replyToMessageId ?? null);
  }

  @Post(':chatId/cards')
  card(
    @CurrentUser() actor: JwtPayload,
    @Param('chatId') chatId: string,
    @Body() dto: CreateCrmCardDto,
  ) {
    return this.messages.createCrmCard(
      actor,
      chatId,
      dto.type,
      dto.refEntityType,
      dto.refEntityId,
    );
  }

  @Post(':chatId/pins/:messageId')
  pin(
    @CurrentUser() actor: JwtPayload,
    @Param('chatId') chatId: string,
    @Param('messageId') messageId: string,
  ) {
    return this.chats.pin(actor, chatId, messageId);
  }

  @Delete(':chatId/pins/:messageId')
  unpin(
    @CurrentUser() actor: JwtPayload,
    @Param('chatId') chatId: string,
    @Param('messageId') messageId: string,
  ) {
    return this.chats.unpin(actor, chatId, messageId);
  }

  @Post(':chatId/attachments')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  upload(
    @CurrentUser() actor: JwtPayload,
    @Param('chatId') chatId: string,
    @Query() dto: UploadAttachmentDto,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) throw new BadRequestException('Attachment file is required');
    return this.attachments.save(
      actor,
      chatId,
      file,
      dto.kind ?? ChatAttachmentKind.File,
      dto.durationMs,
    );
  }
}
