import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { Public } from '../auth/decorators';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
  ) {}

  /**
   * Lo usa el balanceador / App Service para saber si la instancia puede
   * recibir tráfico. Público: el balanceador no tiene token. No expone datos.
   */
  @Public()
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.db.pingCheck('database', { timeout: 1500 })]);
  }
}
