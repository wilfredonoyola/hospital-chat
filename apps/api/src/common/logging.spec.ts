import { Writable } from 'node:stream';
import pino from 'pino';
import { buildLoggerParams, REDACTED_PATHS, resolveRequestId } from './logging';

describe('logging', () => {
  describe('resolveRequestId', () => {
    it('respeta el id que manda el proxy si tiene forma válida', () => {
      expect(resolveRequestId('front-door-1234abcd')).toBe('front-door-1234abcd');
    });

    it.each([undefined, '', 'corto', 'con espacios y {json}', 'x'.repeat(200), ['a', 'b']])(
      'genera uno nuevo si el que llega no sirve (%j)',
      (incoming) => {
        expect(resolveRequestId(incoming)).toMatch(/^[0-9a-f-]{36}$/);
      },
    );
  });

  it('nunca escribe PIN, contraseña ni token, aunque se registre el objeto completo', () => {
    const lines: string[] = [];
    const sink = new Writable({
      write(chunk: Buffer, _encoding, done) {
        lines.push(chunk.toString());
        done();
      },
    });
    const logger = pino({ redact: { paths: REDACTED_PATHS, censor: '[redactado]' } }, sink);

    logger.info({ body: { staffCode: 'ENF001', pin: '2580' } }, 'login');
    logger.info({ password: 'secreta', accessToken: 'eyJ...' }, 'admin');

    const output = lines.join('');
    expect(output).not.toMatch(/2580|secreta|eyJ/);
    expect(output).toContain('ENF001');
    expect(output).toContain('[redactado]');
  });

  it('elige el nivel según el resultado de la petición y no registra /health', () => {
    const { pinoHttp } = buildLoggerParams({ LOG_LEVEL: 'info' }) as {
      pinoHttp: {
        customLogLevel: (req: unknown, res: { statusCode: number }, error?: Error) => string;
        autoLogging: { ignore: (req: { url?: string }) => boolean };
      };
    };

    expect(pinoHttp.customLogLevel({}, { statusCode: 200 })).toBe('info');
    expect(pinoHttp.customLogLevel({}, { statusCode: 401 })).toBe('warn');
    expect(pinoHttp.customLogLevel({}, { statusCode: 503 })).toBe('error');
    expect(pinoHttp.autoLogging.ignore({ url: '/health' })).toBe(true);
    expect(pinoHttp.autoLogging.ignore({ url: '/auth/me' })).toBe(false);
  });
});
