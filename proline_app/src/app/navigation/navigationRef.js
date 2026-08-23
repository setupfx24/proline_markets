import { createNavigationContainerRef } from '@react-navigation/native';

// Lets non-component code (e.g. a tapped push notification) drive navigation.
export const navigationRef = createNavigationContainerRef();

export function navigate(name, params) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  }
}
