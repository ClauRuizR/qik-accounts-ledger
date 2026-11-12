import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { TransactionType } from '../types/models';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type AppStackParamList = {
  Accounts: undefined;
  CreateAccount: undefined;
  AccountDetails: { accountId: string };
  PostTransaction: { accountId: string; type: TransactionType };
  TransactionHistory: { accountId: string };
  BalanceSummary: { accountId: string };
};

export type AuthScreenProps<T extends keyof AuthStackParamList> = NativeStackScreenProps<
  AuthStackParamList,
  T
>;
export type AppScreenProps<T extends keyof AppStackParamList> = NativeStackScreenProps<
  AppStackParamList,
  T
>;
