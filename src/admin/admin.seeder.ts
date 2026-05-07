import { Injectable } from '@nestjs/common';
import { EntityManager } from '@mikro-orm/core';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { Admin } from './entities/admin.entity';

@Injectable()
export class AdminSeeder {
  constructor(
    private readonly em: EntityManager,
    private readonly config: ConfigService,
  ) {}

  async seed(): Promise<void> {
    const em = this.em.fork();
    const username = this.config.get('ADMIN_USERNAME', 'admin');
    const password = this.config.get<string>('ADMIN_PASSWORD', 'admin123');

    const existing = await em.findOne(Admin, { username });
    if (existing) return;

    const passwordHash = await bcrypt.hash(password, 10);
    const admin = em.create(Admin, { username, passwordHash });
    await em.flush();
    console.log(`Admin seeded: ${username}`);
  }
}
