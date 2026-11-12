import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Not, Repository } from 'typeorm';
import { Actor, AuditService } from '../audit/audit.service';
import { PasswordHasher } from '../common/password-hasher';
import { Department } from '../departments/department.entity';
import { Role } from './role';
import { toUserResponse, UserResponse } from './user.response';
import { User } from './user.entity';
import { CreateUserDto, UpdateUserDto } from './users-admin.dto';

const ENTITY = 'user';

/**
 * Gestión del personal por un admin. Los administradores no se gestionan por
 * API (se crean desde variables de entorno), así que aquí un admin "no existe".
 */
@Injectable()
export class UsersAdminService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly hasher: PasswordHasher,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<UserResponse[]> {
    const users = await this.users.find({
      where: { role: Not(Role.ADMIN) },
      relations: { departments: true },
      order: { fullName: 'ASC' },
    });
    return users.map(toUserResponse);
  }

  async create(dto: CreateUserDto, actor: Actor): Promise<UserResponse> {
    // argon2 tarda decenas de ms: se calcula fuera de la transacción para no
    // tenerla abierta (con sus locks) mientras tanto.
    const pinHash = await this.hasher.hash(dto.pin);

    return this.dataSource.transaction(async (manager) => {
      // El UNIQUE de staff_code y la FK de áreas los valida la base; si fallan,
      // DatabaseExceptionFilter responde 409 o 400 y la transacción se revierte.
      const user = await manager.save(
        manager.create(User, {
          fullName: dto.fullName,
          role: dto.role,
          staffCode: dto.staffCode,
          pinHash,
          departments: dto.departmentIds.map((id) => ({ id }) as Department),
        }),
      );

      await this.audit.record(manager, actor, {
        action: 'user.created',
        entityType: ENTITY,
        entityId: user.id,
        metadata: {
          staffCode: dto.staffCode,
          role: dto.role,
          departmentIds: dto.departmentIds,
        },
      });

      return toUserResponse(await this.findManaged(manager, user.id));
    });
  }

  async update(userId: string, dto: UpdateUserDto, actor: Actor): Promise<UserResponse> {
    return this.dataSource.transaction(async (manager) => {
      const user = await this.findManaged(manager, userId);
      const changes: Record<string, unknown> = {};

      if (dto.fullName !== undefined && dto.fullName !== user.fullName) {
        changes.fullName = { from: user.fullName, to: dto.fullName };
        user.fullName = dto.fullName;
      }
      if (dto.role !== undefined && dto.role !== user.role) {
        changes.role = { from: user.role, to: dto.role };
        user.role = dto.role;
      }
      if (dto.isActive !== undefined && dto.isActive !== user.isActive) {
        changes.isActive = { from: user.isActive, to: dto.isActive };
        user.isActive = dto.isActive;
      }
      if (dto.departmentIds !== undefined) {
        const before = user.departments.map((department) => department.id).sort();
        const after = [...dto.departmentIds].sort();
        if (before.join() !== after.join()) {
          changes.departmentIds = { from: before, to: after };
          user.departments = dto.departmentIds.map((id) => ({ id }) as Department);
        }
      }

      if (Object.keys(changes).length === 0) {
        return toUserResponse(user);
      }

      await manager.save(user);
      if (changes.isActive && dto.isActive === false) {
        // Desactivar corta el acceso ya, no cuando venza el token.
        await manager.increment(User, { id: userId }, 'tokenVersion', 1);
      }

      await this.audit.record(manager, actor, {
        action: 'user.updated',
        entityType: ENTITY,
        entityId: userId,
        metadata: changes,
      });

      return toUserResponse(await this.findManaged(manager, userId));
    });
  }

  /** Nuevo PIN: desbloquea la cuenta y cierra todas sus sesiones. */
  async resetPin(userId: string, pin: string, actor: Actor): Promise<void> {
    const pinHash = await this.hasher.hash(pin);

    await this.dataSource.transaction(async (manager) => {
      const result = await manager
        .createQueryBuilder()
        .update(User)
        .set({
          pinHash,
          failedLoginAttempts: 0,
          lockedUntil: null,
          tokenVersion: () => 'token_version + 1',
        })
        .where('id = :userId AND role <> :admin', { userId, admin: Role.ADMIN })
        .execute();

      if (result.affected === 0) {
        throw new NotFoundException('Usuario no encontrado');
      }

      // Nunca se audita el PIN, ni siquiera su hash.
      await this.audit.record(manager, actor, {
        action: 'user.pin_reset',
        entityType: ENTITY,
        entityId: userId,
      });
    });
  }

  private async findManaged(manager: EntityManager, userId: string): Promise<User> {
    const user = await manager.findOne(User, {
      where: { id: userId, role: In([Role.SUPERVISOR, Role.STAFF]) },
      relations: { departments: true },
    });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return user;
  }
}
