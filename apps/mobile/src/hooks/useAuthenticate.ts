import { useMutation } from '@apollo/client/react';
import { useState } from 'react';
import { LOGIN, REGISTER } from '../services/graphql/operations';
import { getErrorMessage } from '../services/graphql/errors';
import type { User } from '../types/models';
import { useAuth } from './useAuth';

type AuthPayload = { accessToken: string; user: User };
type Mode = 'login' | 'register';

/** Login or registration: calls the API and starts the session on success. */
export function useAuthenticate(mode: Mode) {
  const { signIn } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [mutate, { loading }] = useMutation<
    { login?: AuthPayload; register?: AuthPayload },
    { input: { email: string; password: string } }
  >(mode === 'login' ? LOGIN : REGISTER);

  const submit = async (email: string, password: string): Promise<boolean> => {
    setError(null);
    try {
      const { data } = await mutate({ variables: { input: { email: email.trim(), password } } });
      const payload = data?.login ?? data?.register;
      if (!payload) throw new Error('Empty response');
      await signIn(payload.accessToken);
      return true;
    } catch (e) {
      setError(getErrorMessage(e));
      return false;
    }
  };

  return { submit, loading, error };
}
