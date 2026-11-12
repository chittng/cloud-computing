import { Controller, Get } from "@nestjs/common";
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from "@nestjs/terminus";
import { Public } from "../auth/public.decorator.ts";

@Public()
@Controller("health")
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
  ) {}

  /** 200 while MySQL answers a ping, 503 otherwise. */
  @Get()
  @HealthCheck()
  check() {
    return this.health.check([async () => this.db.pingCheck("database").withTimeout(1000)]);
  }
}
