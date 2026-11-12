import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiTooManyRequestsResponse } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { UsersService } from '../users/users.service';
import { UserResponse } from '../users/user.response';
import { AdminLoginDto, StaffLoginDto } from './auth.dto';
import { AuthService, LoginResult } from './auth.service';
import { AuthUser } from './auth-user';
import { CurrentUser, Public } from './decorators';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @ApiTooManyRequestsResponse({ description: 'Demasiados intentos desde esta IP' })
  @Post('staff/login')
  @HttpCode(HttpStatus.OK)
  loginStaff(@Body() dto: StaffLoginDto): Promise<LoginResult> {
    return this.auth.loginStaff(dto.staffCode, dto.pin);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @ApiTooManyRequestsResponse({ description: 'Demasiados intentos desde esta IP' })
  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  loginAdmin(@Body() dto: AdminLoginDto): Promise<LoginResult> {
    return this.auth.loginAdmin(dto.email, dto.password);
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: AuthUser): Promise<UserResponse> {
    return this.users.getProfile(user.id);
  }

  /** Cierra la sesión en todos los equipos: invalida todos los tokens emitidos. */
  @ApiBearerAuth()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@CurrentUser() user: AuthUser): Promise<void> {
    return this.auth.logout(user.id);
  }
}
