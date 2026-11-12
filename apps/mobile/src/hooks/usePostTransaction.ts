import { useMutation } from '@apollo/client/react';
import * as Crypto from 'expo-crypto';
import { useRef, useState } from 'react';
import { getErrorMessage } from '../services/graphql/errors';
import {
  CREDIT_ACCOUNT,
  DEBIT_ACCOUNT,
  QUERIES_AFFECTED_BY_POSTING,
} from '../services/graphql/operations';
import type { Transaction, TransactionType } from '../types/models';
import { normalizeAmount } from '../utils/money';

interface PostInput {
  accountId: string;
  amount: string;
  description?: string;
  idempotencyKey: string;
}

/**
 * Credits or debits an account.
 *
 * Idempotency: one key per intended transaction. The key is reused when the
 * same values are resubmitted (e.g. retry after a network error, where the
 * first attempt may have been applied) and regenerated when the values change
 * or after a success — so a retry can never post twice.
 */
export function usePostTransaction(type: TransactionType) {
  const [error, setError] = useState<string | null>(null);
  const draftKey = useRef<{ fingerprint: string; key: string } | null>(null);
  const [mutate, { loading }] = useMutation<
    { creditAccount?: Transaction; debitAccount?: Transaction },
    { input: PostInput }
  >(type === 'CREDIT' ? CREDIT_ACCOUNT : DEBIT_ACCOUNT, {
    refetchQueries: QUERIES_AFFECTED_BY_POSTING,
    awaitRefetchQueries: true,
  });

  const idempotencyKeyFor = (fingerprint: string): string => {
    if (draftKey.current?.fingerprint !== fingerprint) {
      draftKey.current = { fingerprint, key: Crypto.randomUUID() };
    }
    return draftKey.current.key;
  };

  const post = async (
    accountId: string,
    amount: string,
    description: string,
  ): Promise<Transaction | null> => {
    setError(null);
    const normalized = normalizeAmount(amount);
    const trimmed = description.trim();
    const idempotencyKey = idempotencyKeyFor(`${accountId}|${normalized}|${trimmed}`);
    try {
      const { data } = await mutate({
        variables: {
          input: {
            accountId,
            amount: normalized,
            ...(trimmed ? { description: trimmed } : {}),
            idempotencyKey,
          },
        },
      });
      draftKey.current = null; // next transaction gets a fresh key
      return data?.creditAccount ?? data?.debitAccount ?? null;
    } catch (e) {
      setError(getErrorMessage(e));
      return null;
    }
  };

  return { post, loading, error };
}
