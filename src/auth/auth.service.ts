import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@mikro-orm/nestjs';
import { EntityRepository } from '@mikro-orm/core';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Admin } from '../admin/entities/admin.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Admin)
    private readonly adminRepo: EntityRepository<Admin>,
    private readonly jwtService: JwtService,
  ) {}

  async login(username: string, password: string): Promise<{ access_token: string }> {
    const admin = await this.adminRepo.findOne({ username });
    if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return {
      access_token: this.jwtService.sign({ sub: admin.id, username: admin.username }),
    };
  }
}
