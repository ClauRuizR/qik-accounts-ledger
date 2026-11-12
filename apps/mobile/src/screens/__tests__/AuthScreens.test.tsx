import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { LoginScreen } from '../auth/LoginScreen';
import { RegisterScreen } from '../auth/RegisterScreen';
import { LOGIN, REGISTER } from '../../services/graphql/operations';
import { graphQLErrorResult } from '../../test-utils/fixtures';
import { authScreenProps } from '../../test-utils/navigation';
import { createAuthMock, renderWithProviders } from '../../test-utils/render';

const authPayload = (token: string) => ({
  __typename: 'AuthPayload',
  accessToken: token,
  user: { __typename: 'User', id: 'u1', email: 'ana@qik.do' },
});

const fill = async (email: string, password: string) => {
  await fireEvent.changeText(screen.getByTestId('email-input'), email);
  await fireEvent.changeText(screen.getByTestId('password-input'), password);
};
const submit = () => fireEvent.press(screen.getByTestId('auth-submit'));

describe('LoginScreen', () => {
  it('validates fields before calling the API', async () => {
    const auth = createAuthMock({ status: 'signedOut' });
    const { props } = authScreenProps('Login');
    await renderWithProviders(<LoginScreen {...props} />, { auth });

    await submit();
    expect(screen.getByText('Enter your email')).toBeOnTheScreen();
    expect(screen.getByText('Enter your password')).toBeOnTheScreen();

    await fill('not-an-email', 'x');
    await submit();
    expect(screen.getByText('Enter a valid email address')).toBeOnTheScreen();
    expect(auth.signIn).not.toHaveBeenCalled();
  });

  it('signs in with a trimmed email and stores the token', async () => {
    const auth = createAuthMock({ status: 'signedOut' });
    const { props } = authScreenProps('Login');
    await renderWithProviders(<LoginScreen {...props} />, {
      auth,
      mocks: [
        {
          request: {
            query: LOGIN,
            variables: { input: { email: 'ana@qik.do', password: 'secret-pass' } },
          },
          result: { data: { login: authPayload('jwt-token') } },
        },
      ],
    });

    await fill('  ana@qik.do ', 'secret-pass');
    await submit();
    await waitFor(() => expect(auth.signIn).toHaveBeenCalledWith('jwt-token'));
  });

  it('shows invalid credentials without signing in', async () => {
    const auth = createAuthMock({ status: 'signedOut' });
    const { props } = authScreenProps('Login');
    await renderWithProviders(<LoginScreen {...props} />, {
      auth,
      mocks: [
        {
          request: {
            query: LOGIN,
            variables: { input: { email: 'ana@qik.do', password: 'wrong-pass' } },
          },
          result: graphQLErrorResult('INVALID_CREDENTIALS'),
        },
      ],
    });

    await fill('ana@qik.do', 'wrong-pass');
    await submit();
    expect(await screen.findByText('Invalid email or password.')).toBeOnTheScreen();
    expect(auth.signIn).not.toHaveBeenCalled();
  });

  it('navigates to registration', async () => {
    const { props, navigation } = authScreenProps('Login');
    await renderWithProviders(<LoginScreen {...props} />, {
      auth: createAuthMock({ status: 'signedOut' }),
    });
    await fireEvent.press(screen.getByRole('button', { name: 'New to Qik? Create an account' }));
    expect(navigation.navigate).toHaveBeenCalledWith('Register');
  });
});

describe('RegisterScreen', () => {
  it('requires at least 8 password characters', async () => {
    const { props } = authScreenProps('Register');
    await renderWithProviders(<RegisterScreen {...props} />, {
      auth: createAuthMock({ status: 'signedOut' }),
    });
    await fill('ana@qik.do', 'short');
    await submit();
    expect(screen.getByText('Password must be at least 8 characters')).toBeOnTheScreen();
  });

  it('registers and signs in; reports a taken email', async () => {
    const auth = createAuthMock({ status: 'signedOut' });
    const { props } = authScreenProps('Register');
    const variables = { input: { email: 'ana@qik.do', password: 'secret-pass' } };
    await renderWithProviders(<RegisterScreen {...props} />, {
      auth,
      mocks: [
        {
          request: { query: REGISTER, variables },
          result: graphQLErrorResult('EMAIL_ALREADY_REGISTERED'),
        },
        {
          request: { query: REGISTER, variables },
          result: { data: { register: authPayload('new-jwt') } },
        },
      ],
    });

    await fill('ana@qik.do', 'secret-pass');
    await submit();
    expect(await screen.findByText('An account with this email already exists.')).toBeOnTheScreen();

    await submit();
    await waitFor(() => expect(auth.signIn).toHaveBeenCalledWith('new-jwt'));
  });
});
