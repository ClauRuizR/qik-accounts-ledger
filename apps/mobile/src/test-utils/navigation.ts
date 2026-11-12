import type {
  AppScreenProps,
  AppStackParamList,
  AuthScreenProps,
  AuthStackParamList,
} from '../navigation/types';

/**
 * Minimal navigation/route doubles for rendering a screen in isolation.
 * Only the methods the screens call are implemented; each is a jest.fn().
 */
function navigationMock() {
  return {
    navigate: jest.fn(),
    replace: jest.fn(),
    goBack: jest.fn(),
    setOptions: jest.fn(),
  };
}

export function appScreenProps<T extends keyof AppStackParamList>(
  name: T,
  params: AppStackParamList[T],
) {
  const navigation = navigationMock();
  const props = {
    navigation,
    route: { key: `${name}-test`, name, params },
  } as unknown as AppScreenProps<T>;
  return { props, navigation };
}

export function authScreenProps<T extends keyof AuthStackParamList>(name: T) {
  const navigation = navigationMock();
  const props = {
    navigation,
    route: { key: `${name}-test`, name, params: undefined },
  } as unknown as AuthScreenProps<T>;
  return { props, navigation };
}
