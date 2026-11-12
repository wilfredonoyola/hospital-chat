import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Actor, AuditService } from '../audit/audit.service';
import { Department } from './department.entity';
import { CreateDepartmentDto, UpdateDepartmentDto } from './departments-admin.dto';

const ENTITY = 'department';

/** CRUD simple: sin reglas de negocio, no necesita capas extra (ver fase 2). */
@Injectable()
export class DepartmentsAdminService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Department) private readonly departments: Repository<Department>,
    private readonly audit: AuditService,
  ) {}

  list(): Promise<Department[]> {
    return this.departments.find({ order: { name: 'ASC' } });
  }

  create(dto: CreateDepartmentDto, actor: Actor): Promise<Department> {
    return this.dataSource.transaction(async (manager) => {
      const department = await manager.save(
        manager.create(Department, { name: dto.name, description: dto.description ?? null }),
      );
      await this.audit.record(manager, actor, {
        action: 'department.created',
        entityType: ENTITY,
        entityId: department.id,
        metadata: { name: department.name },
      });
      return department;
    });
  }

  update(id: string, dto: UpdateDepartmentDto, actor: Actor): Promise<Department> {
    return this.dataSource.transaction(async (manager) => {
      const department = await manager.findOne(Department, { where: { id } });
      if (!department) {
        throw new NotFoundException('Área no encontrada');
      }

      const changes: Record<string, unknown> = {};
      for (const field of ['name', 'description', 'isActive'] as const) {
        const value = dto[field];
        if (value !== undefined && value !== department[field]) {
          changes[field] = { from: department[field], to: value };
          Object.assign(department, { [field]: value });
        }
      }
      if (Object.keys(changes).length === 0) {
        return department;
      }

      const saved = await manager.save(department);
      await this.audit.record(manager, actor, {
        action: 'department.updated',
        entityType: ENTITY,
        entityId: id,
        metadata: changes,
      });
      return saved;
    });
  }
}
