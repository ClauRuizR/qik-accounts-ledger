import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { Currency } from '../../accounts/domain/currency.js';
import {
  LedgerReadRepository,
  type TransactionPage,
} from '../application/ports/ledger-read.repository.js';
import type { BalanceSummary } from '../domain/balance-summary.js';
import type { LedgerEntry } from '../domain/ledger-entry.js';
import type {
  LedgerEntryWithPosition,
  TransactionQuery,
} from '../domain/transaction-query.js';
import { CURSOR_TS_COLUMN, ENTRY_COLUMNS } from './ledger-entry.sql.js';

type EntryRow = LedgerEntry & { cursorTs: string };

@Injectable()
export class TypeOrmLedgerReadRepository extends LedgerReadRepository {
  constructor(private readonly dataSource: DataSource) {
    super();
  }

  async findTransactions(query: TransactionQuery): Promise<TransactionPage> {
    // Filters are built from a fixed set of predicates; every value is a bound parameter.
    const params: unknown[] = [query.accountId];
    const filters = ['account_id = $1'];
    if (query.type) {
      params.push(query.type);
      filters.push(`type = $${params.length}`);
    }
    if (query.startDate) {
      params.push(query.startDate);
      filters.push(`created_at >= $${params.length}`);
    }
    if (query.endDate) {
      params.push(query.endDate);
      filters.push(`created_at <= $${params.length}`);
    }
    const filterSql = filters.join(' AND ');
    const filterParams = [...params];

    const direction = query.sortOrder === 'ASC' ? 'ASC' : 'DESC';
    const pageFilters = [...filters];
    if (query.after) {
      params.push(query.after.createdAt, query.after.seq);
      const op = direction === 'ASC' ? '>' : '<';
      // Row-value comparison = keyset pagination on the (created_at, seq) index.
      pageFilters.push(
        `(created_at, seq) ${op} ($${params.length - 1}::timestamptz, $${params.length}::bigint)`,
      );
    }
    params.push(query.limit + 1); // one extra row tells us whether a next page exists

    const [rows, countRows] = await Promise.all([
      this.dataSource.query<EntryRow[]>(
        `SELECT ${ENTRY_COLUMNS}, ${CURSOR_TS_COLUMN}
           FROM ledger_entries
          WHERE ${pageFilters.join(' AND ')}
          ORDER BY created_at ${direction}, seq ${direction}
          LIMIT $${params.length}`,
        params,
      ),
      this.dataSource.query<{ count: number }[]>(
        `SELECT count(*)::int AS count FROM ledger_entries WHERE ${filterSql}`,
        filterParams,
      ),
    ]);

    const items: LedgerEntryWithPosition[] = rows
      .slice(0, query.limit)
      .map(({ cursorTs, ...entry }) => ({
        ...entry,
        position: { createdAt: cursorTs, seq: entry.seq },
      }));
    return {
      items,
      hasNextPage: rows.length > query.limit,
      totalCount: countRows[0].count,
    };
  }

  computeSummary(
    accountId: string,
    historyPoints: number,
  ): Promise<BalanceSummary | null> {
    // REPEATABLE READ: balance, totals and history all come from the same
    // snapshot, so they are mutually consistent even while postings commit.
    return this.dataSource.transaction('REPEATABLE READ', async (manager) => {
      await manager.query('SET TRANSACTION READ ONLY');

      const [account] = await manager.query<
        { balance: string; currency: Currency; version: number }[]
      >(`SELECT balance, currency, version FROM accounts WHERE id = $1`, [
        accountId,
      ]);
      if (!account) return null;

      const [totals] = await manager.query<
        { credits: string; debits: string; count: number }[]
      >(
        `SELECT COALESCE(SUM(amount) FILTER (WHERE type = 'CREDIT'), 0)::numeric(20,2) AS credits,
                COALESCE(SUM(amount) FILTER (WHERE type = 'DEBIT'), 0)::numeric(20,2)  AS debits,
                count(*)::int AS count
           FROM ledger_entries WHERE account_id = $1`,
        [accountId],
      );

      const history = await manager.query<{ at: Date; balance: string }[]>(
        `SELECT created_at AS at, balance_after AS balance
           FROM ledger_entries WHERE account_id = $1
          ORDER BY created_at DESC, seq DESC
          LIMIT $2`,
        [accountId, historyPoints],
      );

      return {
        accountId,
        version: account.version,
        currency: account.currency,
        currentBalance: account.balance,
        totalCredits: totals.credits,
        totalDebits: totals.debits,
        transactionCount: totals.count,
        history: history.reverse(),
      };
    });
  }
}
