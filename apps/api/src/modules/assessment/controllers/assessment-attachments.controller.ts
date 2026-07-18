import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { JwtPayload } from '../../auth/auth.service';
import { DownloadAttachmentQueryDto } from '../dto';
import { AssessmentAttachmentService } from '../services/assessment-attachment.service';

@ApiTags('Assessment Attachments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('assessment/attachments')
export class AssessmentAttachmentsController {
  constructor(private readonly attachments: AssessmentAttachmentService) {}

  @Get(':attachmentId/download')
  @Roles('admin', 'teacher', 'student')
  @ApiOperation({ summary: 'Download question attachment' })
  @ApiResponse({ status: 200, description: 'Attachment file stream' })
  download(
    @CurrentUser() user: JwtPayload,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Query() query: DownloadAttachmentQueryDto,
  ) {
    return this.attachments.download(
      attachmentId,
      user,
      query.disposition ?? 'inline',
    );
  }
}
