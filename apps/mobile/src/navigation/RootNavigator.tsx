import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoadingState } from '../components/common/States';
import { useAuth } from '../hooks/useAuth';
import { AccountDetailsScreen } from '../screens/accounts/AccountDetailsScreen';
import { AccountsListScreen } from '../screens/accounts/AccountsListScreen';
import { CreateAccountScreen } from '../screens/accounts/CreateAccountScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { BalanceSummaryScreen } from '../screens/transactions/BalanceSummaryScreen';
import { PostTransactionScreen } from '../screens/transactions/PostTransactionScreen';
import { TransactionHistoryScreen } from '../screens/transactions/TransactionHistoryScreen';
import { colors } from '../theme';
import type { AppStackParamList, AuthStackParamList } from './types';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();

const screenOptions = {
  headerTintColor: colors.primary,
  headerTitleStyle: { color: colors.text },
  contentStyle: { backgroundColor: colors.background },
};

/**
 * Two separate stacks: signed-out users can only reach the auth screens, and
 * signing out unmounts every screen that holds account data. Nothing renders
 * until the stored token has been read, so the wrong stack never flashes.
 */
export function RootNavigator() {
  const { status } = useAuth();

  if (status === 'loading') return <LoadingState message="Starting…" />;

  return (
    <NavigationContainer>
      {status === 'signedIn' ? (
        <AppStack.Navigator screenOptions={screenOptions}>
          <AppStack.Screen
            name="Accounts"
            component={AccountsListScreen}
            options={{ title: 'My accounts' }}
          />
          <AppStack.Screen
            name="CreateAccount"
            component={CreateAccountScreen}
            options={{ title: 'New account', presentation: 'modal' }}
          />
          <AppStack.Screen
            name="AccountDetails"
            component={AccountDetailsScreen}
            options={{ title: 'Account' }}
          />
          <AppStack.Screen
            name="PostTransaction"
            component={PostTransactionScreen}
            options={({ route }) => ({
              title: route.params.type === 'CREDIT' ? 'Credit' : 'Debit',
              presentation: 'modal',
            })}
          />
          <AppStack.Screen
            name="TransactionHistory"
            component={TransactionHistoryScreen}
            options={{ title: 'Transactions' }}
          />
          <AppStack.Screen
            name="BalanceSummary"
            component={BalanceSummaryScreen}
            options={{ title: 'Balance summary' }}
          />
        </AppStack.Navigator>
      ) : (
        <AuthStack.Navigator screenOptions={screenOptions}>
          <AuthStack.Screen name="Login" component={LoginScreen} options={{ title: 'Sign in' }} />
          <AuthStack.Screen
            name="Register"
            component={RegisterScreen}
            options={{ title: 'Create account' }}
          />
        </AuthStack.Navigator>
      )}
    </NavigationContainer>
  );
}
