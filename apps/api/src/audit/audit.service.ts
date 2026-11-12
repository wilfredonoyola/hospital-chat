import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';

/** Quién hace la acción y desde dónde. */
export interface Actor {
  id: string;
  ip: string | null;
}

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  constructor(@InjectRepository(AuditLog) private readonly logs: Repository<AuditLog>) {}

  /**
   * Recibe el EntityManager de la transacción del cambio: la acción y su
   * auditoría se confirman juntas o no se confirma ninguna. Nunca queda un
   * cambio sin rastro, ni un rastro de un cambio que no ocurrió.
   */
  async record(manager: EntityManager, actor: Actor, entry: AuditEntry): Promise<void> {
    await manager.save(
      manager.create(AuditLog, {
        actorId: actor.id,
        ip: actor.ip,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        metadata: entry.metadata ?? {},
      }),
    );
  }

  latest(limit: number): Promise<AuditLog[]> {
    return this.logs.find({ order: { createdAt: 'DESC' }, take: limit });
  }
}
