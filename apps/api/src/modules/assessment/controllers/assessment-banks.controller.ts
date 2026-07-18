import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
import {
  CreateBankDto,
  ListBanksQueryDto,
  UpdateBankDto,
  paginateArray,
} from '../dto';
import { AssessmentContentGuard } from '../services/assessment-content.guard';
import { AssessmentBankService } from '../services/assessment-bank.service';

@ApiTags('Assessment Banks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('assessment/banks')
export class AssessmentBanksController {
  constructor(
    private readonly bankService: AssessmentBankService,
    private readonly guard: AssessmentContentGuard,
  ) {}

  @Post()
  @Roles('admin', 'teacher')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create question bank' })
  @ApiResponse({ status: 201, description: 'Bank created' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateBankDto) {
    return this.bankService.create({
      name: dto.name,
      description: dto.description ?? null,
      locale: dto.locale ?? null,
      createdByUserId: user.sub,
    });
  }

  @Get()
  @Roles('admin', 'teacher')
  @ApiOperation({ summary: 'List question banks' })
  @ApiResponse({ status: 200, description: 'Paginated bank list' })
  async list(@Query() query: ListBanksQueryDto) {
    let items = await this.bankService.list(query.status);
    if (query.search) {
      const needle = query.search.toLowerCase();
      items = items.filter(
        (bank) =>
          bank.name.toLowerCase().includes(needle) ||
          (bank.description?.toLowerCase().includes(needle) ?? false),
      );
    }
    return paginateArray(items, query.limit, query.offset);
  }

  @Get(':bankId')
  @Roles('admin', 'teacher')
  @ApiOperation({ summary: 'Get question bank by id' })
  @ApiResponse({ status: 200, description: 'Bank detail' })
  async findOne(@Param('bankId', ParseUUIDPipe) bankId: string) {
    return this.guard.requireFound(await this.bankService.findById(bankId), 'Bank');
  }

  @Patch(':bankId')
  @Roles('admin', 'teacher')
  @ApiOperation({ summary: 'Update draft question bank' })
  @ApiResponse({ status: 200, description: 'Bank updated' })
  update(@Param('bankId', ParseUUIDPipe) bankId: string, @Body() dto: UpdateBankDto) {
    return this.bankService.update(bankId, {
      name: dto.name,
      description: dto.description,
      locale: dto.locale,
    });
  }

  @Post(':bankId/publish')
  @Roles('admin', 'teacher')
  @ApiOperation({ summary: 'Publish question bank' })
  @ApiResponse({ status: 200, description: 'Bank published' })
  publish(@Param('bankId', ParseUUIDPipe) bankId: string) {
    return this.bankService.publish(bankId);
  }

  @Post(':bankId/archive')
  @Roles('admin', 'teacher')
  @ApiOperation({ summary: 'Archive question bank' })
  @ApiResponse({ status: 200, description: 'Bank archived' })
  archive(@Param('bankId', ParseUUIDPipe) bankId: string) {
    return this.bankService.archive(bankId);
  }
}
