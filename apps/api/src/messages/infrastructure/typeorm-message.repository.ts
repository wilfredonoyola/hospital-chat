import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessageRepository } from '../application/ports/message.repository';
import { Message } from '../domain/message';
import { MessageRecord } from './message-record.entity';

/** Adaptador de escritura: traduce el mensaje de dominio a una fila. */
@Injectable()
export class TypeOrmMessageRepository extends MessageRepository {
  constructor(
    @InjectRepository(MessageRecord) private readonly records: Repository<MessageRecord>,
  ) {
    super();
  }

  async save(message: Message): Promise<void> {
    // insert y no save: un mensaje nunca se actualiza, y así TypeORM no hace un SELECT previo.
    await this.records.insert(message.toSnapshot());
  }
}
