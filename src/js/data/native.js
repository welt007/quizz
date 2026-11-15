// Bridge to the Android app (android/…/MainActivity.java), injected as
// window.QuizshowNative. In the browser it does not exist and everything
// uses localStorage/IndexedDB as before.
//
// Interface (all synchronous, strings only):
//   getItem(key) → string|null   setItem(key, value) → boolean   removeItem(key)
//   readData(key) → string|null  writeData(key, value) → boolean deleteData(key)
// Items are small JSON values (SharedPreferences), data are catalog contents (files).
export function nativeBridge() {
  try {
    const bridge = typeof window !== 'undefined' ? window.QuizshowNative : undefined;
    return bridge && typeof bridge.getItem === 'function' ? bridge : null;
  } catch {
    return null;
  }
}
