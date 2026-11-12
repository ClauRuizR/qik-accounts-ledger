import type { AuthScreenProps } from '../../navigation/types';
import { AuthForm } from './AuthForm';

export function LoginScreen({ navigation }: AuthScreenProps<'Login'>) {
  return (
    <AuthForm
      mode="login"
      switchLabel="New to Qik? Create an account"
      onSwitch={() => navigation.navigate('Register')}
    />
  );
}
