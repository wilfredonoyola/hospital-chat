import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser, Roles } from '../auth/decorators';
import { Role } from './role';
import { UserResponse } from './user.response';
import { CreateUserDto, ResetPinDto, UpdateUserDto } from './users-admin.dto';
import { UsersAdminService } from './users-admin.service';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/users')
export class UsersAdminController {
  constructor(private readonly users: UsersAdminService) {}

  @Get()
  list(): Promise<UserResponse[]> {
    return this.users.list();
  }

  @Post()
  create(
    @Body() dto: CreateUserDto,
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ): Promise<UserResponse> {
    return this.users.create(dto, { id: user.id, ip });
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ): Promise<UserResponse> {
    return this.users.update(id, dto, { id: user.id, ip });
  }

  @Post(':id/reset-pin')
  @HttpCode(HttpStatus.NO_CONTENT)
  resetPin(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetPinDto,
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ): Promise<void> {
    return this.users.resetPin(id, dto.pin, { id: user.id, ip });
  }
}
