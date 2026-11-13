import { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { Server, ServerOptions } from 'socket.io';

/**
 * Socket.IO con los mismos orígenes de CORS que la API HTTP, leídos de la
 * configuración en lugar de fijarlos en el decorador del gateway.
 *
 * Con varias instancias de la API, aquí se conecta el adaptador de Redis o
 * Azure Web PubSub para que un mensaje llegue a sockets de otras instancias.
 */
export class CorsIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly origins: string[],
  ) {
    super(app);
  }

  override createIOServer(port: number | undefined, options?: ServerOptions): Server {
    return super.createIOServer(port, {
      ...options,
      cors: { origin: this.origins },
    } as ServerOptions);
  }
}
