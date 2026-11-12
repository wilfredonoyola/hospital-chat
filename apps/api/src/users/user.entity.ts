import {
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Department } from '../departments/department.entity';
import { Role } from './role';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'full_name', type: 'varchar', length: 120 })
  fullName: string;

  @Column({ type: 'enum', enum: Object.values(Role), enumName: 'user_role' })
  role: Role;

  @Column({ type: 'varchar', length: 254, nullable: true })
  email: string | null;

  // select: false — los hashes solo se leen cuando se piden explícitamente (login).
  @Column({ name: 'password_hash', type: 'varchar', length: 255, nullable: true, select: false })
  passwordHash: string | null;

  @Column({ name: 'staff_code', type: 'varchar', length: 12, nullable: true })
  staffCode: string | null;

  @Column({ name: 'pin_hash', type: 'varchar', length: 255, nullable: true, select: false })
  pinHash: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'failed_login_attempts', type: 'smallint', default: 0, select: false })
  failedLoginAttempts: number;

  @Column({ name: 'locked_until', type: 'timestamptz', nullable: true, select: false })
  lockedUntil: Date | null;

  /** Se incrementa para invalidar todos los tokens emitidos (logout, desactivar, reset de PIN). */
  @Column({ name: 'token_version', type: 'integer', default: 0, select: false })
  tokenVersion: number;

  @ManyToMany(() => Department)
  @JoinTable({
    name: 'department_members',
    joinColumn: { name: 'user_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'department_id', referencedColumnName: 'id' },
  })
  departments: Department[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
