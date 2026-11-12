import type { AuthScreenProps } from '../../navigation/types';
import { AuthForm } from './AuthForm';

export function RegisterScreen({ navigation }: AuthScreenProps<'Register'>) {
  return (
    <AuthForm
      mode="register"
      switchLabel="Already have an account? Sign in"
      onSwitch={() => navigation.navigate('Login')}
    />
  );
}
