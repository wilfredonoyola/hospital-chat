/** Puerto: ¿esta persona pertenece a esta área activa? (regla R1) */
export abstract class DepartmentAccess {
  abstract canAccess(userId: string, departmentId: string): Promise<boolean>;
}
