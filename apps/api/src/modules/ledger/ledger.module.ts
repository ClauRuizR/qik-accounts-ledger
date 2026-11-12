import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountsModule } from '../accounts/accounts.module.js';
import { BalanceSummaryCache } from './application/balance-summary-cache.js';
import { LedgerEvents } from './application/ports/ledger-events.js';
import { LedgerReadRepository } from './application/ports/ledger-read.repository.js';
import { LedgerUnitOfWork } from './application/ports/ledger-unit-of-work.js';
import { GetBalanceSummaryUseCase } from './application/use-cases/get-balance-summary.use-case.js';
import { ListTransactionsUseCase } from './application/use-cases/list-transactions.use-case.js';
import { PostTransactionUseCase } from './application/use-cases/post-transaction.use-case.js';
import { LedgerEntryOrmEntity } from './infrastructure/ledger-entry.orm-entity.js';
import { TypeOrmLedgerReadRepository } from './infrastructure/typeorm-ledger-read.repository.js';
import { TypeOrmLedgerUnitOfWork } from './infrastructure/typeorm-ledger-unit-of-work.js';
import { LedgerQueriesResolver } from './presentation/graphql/ledger-queries.resolver.js';
import { LedgerResolver } from './presentation/graphql/ledger.resolver.js';

@Module({
  imports: [TypeOrmModule.forFeature([LedgerEntryOrmEntity]), AccountsModule],
  providers: [
    { provide: LedgerUnitOfWork, useClass: TypeOrmLedgerUnitOfWork },
    { provide: LedgerReadRepository, useClass: TypeOrmLedgerReadRepository },
    BalanceSummaryCache,
    // The summary cache is the (only) listener for committed postings.
    { provide: LedgerEvents, useExisting: BalanceSummaryCache },
    PostTransactionUseCase,
    ListTransactionsUseCase,
    GetBalanceSummaryUseCase,
    LedgerResolver,
    LedgerQueriesResolver,
  ],
})
export class LedgerModule {}
