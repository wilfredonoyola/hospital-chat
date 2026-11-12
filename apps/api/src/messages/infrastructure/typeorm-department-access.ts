import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DepartmentAccess } from '../application/ports/department-access';

@Injectable()
export class TypeOrmDepartmentAccess extends DepartmentAccess {
  constructor(private readonly dataSource: DataSource) {
    super();
  }

  async canAccess(userId: string, departmentId: string): Promise<boolean> {
    const rows = await this.dataSource.query<unknown[]>(
      `SELECT 1
         FROM department_members dm
         JOIN departments d ON d.id = dm.department_id
        WHERE dm.user_id = $1 AND dm.department_id = $2 AND d.is_active`,
      [userId, departmentId],
    );
    return rows.length > 0;
  }
}
