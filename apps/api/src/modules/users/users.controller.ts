import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtPayload } from '../auth/auth.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserRegistryQueryDto } from './dto/user-registry-query.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  list() {
    return this.usersService.list();
  }

  @Get('directory')
  listDirectory() {
    return this.usersService.listDirectory();
  }

  @Get('registry')
  registry(@Query() query: UserRegistryQueryDto) {
    return this.usersService.registry(query);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.usersService.getRegistryItem(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: JwtPayload,
  ) {
    return this.usersService.update(id, dto, actor);
  }

  @Delete('pending-registrations/:id')
  deletePendingRegistration(@Param('id') id: string) {
    return this.usersService.deletePendingRegistration(id);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @CurrentUser() actor: JwtPayload) {
    return this.usersService.delete(id, actor);
  }
}
