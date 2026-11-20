/// <reference types="expo/types" />

declare module 'react-native-gesture-handler';
declare module 'react-native-keyboard-controller' {
  import type { ComponentType, ReactNode } from 'react';
  import type { ScrollViewProps } from 'react-native';

  export type KeyboardAwareScrollViewProps = ScrollViewProps;
  export const KeyboardAwareScrollView: ComponentType<ScrollViewProps>;
  export const KeyboardProvider: ComponentType<{ children?: ReactNode }>;
  export const KeyboardController: unknown;
}

// NOTE: This file should not be edited and should be in your git ignore
