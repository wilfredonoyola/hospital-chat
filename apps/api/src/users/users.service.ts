import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { toUserResponse, UserResponse } from './user.response';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  /** Perfil del usuario actual con sus áreas activas (las que verá en el chat). */
  async getProfile(userId: string): Promise<UserResponse> {
    const user = await this.users.findOne({
      where: { id: userId },
      relations: { departments: true },
    });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    user.departments = user.departments.filter((department) => department.isActive);
    return toUserResponse(user);
  }
}
