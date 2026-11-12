import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { Department } from './department.entity';
import { DepartmentsAdminController } from './departments-admin.controller';
import { DepartmentsAdminService } from './departments-admin.service';

@Module({
  imports: [TypeOrmModule.forFeature([Department]), AuditModule],
  controllers: [DepartmentsAdminController],
  providers: [DepartmentsAdminService],
})
export class DepartmentsModule {}
