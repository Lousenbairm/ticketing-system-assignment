import { defineEntity, InferEntity, p } from '@mikro-orm/core';
import { v4 as uuidv4 } from 'uuid';

export const Admin = defineEntity({
  name: 'Admin',
  properties: {
    id: p.uuid().primary().onCreate(() => uuidv4()),
    username: p.string(),
    passwordHash: p.string(),
    createdAt: p.type(Date).onCreate(() => new Date()),
  },
});

export type Admin = InferEntity<typeof Admin>;
