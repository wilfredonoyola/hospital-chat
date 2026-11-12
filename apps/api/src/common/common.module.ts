import { Global, Module } from '@nestjs/common';
import { Clock, SystemClock } from './clock';
import { Argon2PasswordHasher, PasswordHasher } from './password-hasher';

@Global()
@Module({
  providers: [
    { provide: Clock, useClass: SystemClock },
    { provide: PasswordHasher, useClass: Argon2PasswordHasher },
  ],
  exports: [Clock, PasswordHasher],
})
export class CommonModule {}
