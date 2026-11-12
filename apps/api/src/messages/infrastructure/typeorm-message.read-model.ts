import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Role } from '../../users/role';
import { MessageReadModel, MessageView } from '../application/ports/message-read-model';
import { MessagePriority } from '../domain/message-priority';

interface Row {
  id: string;
  department_id: string;
  body: string;
  priority: MessagePriority;
  created_at: Date;
  author_id: string;
  author_name: string;
  author_role: Role;
}

/**
 * Adaptador de lectura. SQL explícito: una sola consulta con el autor ya
 * unido (sin N+1) y solo las columnas que la pantalla usa.
 */
@Injectable()
export class TypeOrmMessageReadModel extends MessageReadModel {
  constructor(private readonly dataSource: DataSource) {
    super();
  }

  async latestInDepartment(departmentId: string, limit: number): Promise<MessageView[]> {
    const rows = await this.dataSource.query<Row[]>(
      `SELECT m.id, m.department_id, m.body, m.priority, m.created_at,
              u.id AS author_id, u.full_name AS author_name, u.role AS author_role
         FROM messages m
         JOIN users u ON u.id = m.author_id
        WHERE m.department_id = $1
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT $2`,
      [departmentId, limit],
    );

    return rows.map((row) => ({
      id: row.id,
      departmentId: row.department_id,
      body: row.body,
      priority: row.priority,
      createdAt: row.created_at,
      author: { id: row.author_id, fullName: row.author_name, role: row.author_role },
    }));
  }
}
