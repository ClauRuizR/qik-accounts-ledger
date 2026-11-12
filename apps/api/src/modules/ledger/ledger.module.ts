import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  LedgerEvents,
  NoopLedgerEvents,
} from './application/ports/ledger-events.js';
import { LedgerUnitOfWork } from './application/ports/ledger-unit-of-work.js';
import { PostTransactionUseCase } from './application/use-cases/post-transaction.use-case.js';
import { LedgerEntryOrmEntity } from './infrastructure/ledger-entry.orm-entity.js';
import { TypeOrmLedgerUnitOfWork } from './infrastructure/typeorm-ledger-unit-of-work.js';
import { LedgerResolver } from './presentation/graphql/ledger.resolver.js';

@Module({
  imports: [TypeOrmModule.forFeature([LedgerEntryOrmEntity])],
  providers: [
    { provide: LedgerUnitOfWork, useClass: TypeOrmLedgerUnitOfWork },
    { provide: LedgerEvents, useClass: NoopLedgerEvents },
    PostTransactionUseCase,
    LedgerResolver,
  ],
})
export class LedgerModule {}
