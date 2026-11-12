import { Body, Controller, Get, Ip, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser } from '../auth/auth-user';
import { CurrentUser, Roles } from '../auth/decorators';
import { Role } from '../users/role';
import { Department } from './department.entity';
import { CreateDepartmentDto, UpdateDepartmentDto } from './departments-admin.dto';
import { DepartmentsAdminService } from './departments-admin.service';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/departments')
export class DepartmentsAdminController {
  constructor(private readonly departments: DepartmentsAdminService) {}

  @Get()
  list(): Promise<Department[]> {
    return this.departments.list();
  }

  @Post()
  create(
    @Body() dto: CreateDepartmentDto,
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ): Promise<Department> {
    return this.departments.create(dto, { id: user.id, ip });
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDepartmentDto,
    @CurrentUser() user: AuthUser,
    @Ip() ip: string,
  ): Promise<Department> {
    return this.departments.update(id, dto, { id: user.id, ip });
  }
}
