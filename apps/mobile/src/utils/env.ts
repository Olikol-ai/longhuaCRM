/** True when running in Expo Go / development builds. */
export function isDevBuild() {
  return typeof __DEV__ !== 'undefined' && __DEV__;
}
