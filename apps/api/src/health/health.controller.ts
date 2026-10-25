import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('系统')
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  @ApiOperation({ summary: '健康检查' })
  check() {
    return {
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      runtime: `node ${process.version}`,
    };
  }
}
