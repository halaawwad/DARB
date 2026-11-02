import type { ExpoSpeechRecognitionModule as SpeechModule } from 'expo-speech-recognition';

/**
 * Speech recognition through expo-speech-recognition. The native module is not
 * in Expo Go, and `requireNativeModule` throws on import when it is missing, so
 * the package is loaded lazily and every failure falls back to "unavailable" —
 * the voice screen then offers its demo transcript instead.
 */
let cached: typeof SpeechModule | null | undefined;

function speechModule(): typeof SpeechModule | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = (require('expo-speech-recognition') as { ExpoSpeechRecognitionModule: typeof SpeechModule }).ExpoSpeechRecognitionModule;
  } catch {
    cached = null;
  }
  return cached;
}

export function isSpeechAvailable(): boolean {
  try {
    return speechModule()?.isRecognitionAvailable() ?? false;
  } catch {
    return false;
  }
}

export type ListenFailure = 'unavailable' | 'permission' | 'failed';

interface ListenHandlers {
  /** Called with the best transcript so far; `final` once recognition settles. */
  onTranscript: (transcript: string, final: boolean) => void;
  onError: (reason: ListenFailure) => void;
  /** Recognition stopped, by the user or by silence. */
  onEnd: () => void;
}

/** Starts listening in Arabic. Returns a stop function. */
export async function startListening({ onTranscript, onError, onEnd }: ListenHandlers): Promise<() => void> {
  const module = speechModule();
  if (!module || !isSpeechAvailable()) {
    onError('unavailable');
    return () => undefined;
  }

  try {
    const permission = await module.requestPermissionsAsync();
    if (!permission.granted) {
      onError('permission');
      return () => undefined;
    }
  } catch {
    onError('failed');
    return () => undefined;
  }

  const subscriptions = [
    module.addListener('result', (event) => onTranscript(event.results[0]?.transcript ?? '', event.isFinal)),
    module.addListener('error', (event) => onError(event.error === 'not-allowed' ? 'permission' : 'failed')),
    module.addListener('end', () => {
      subscriptions.forEach((subscription) => subscription.remove());
      onEnd();
    }),
  ];

  try {
    module.start({ lang: 'ar', interimResults: true, maxAlternatives: 1 });
  } catch {
    subscriptions.forEach((subscription) => subscription.remove());
    onError('failed');
  }

  return () => {
    try {
      module.stop();
    } catch {
      // Already stopped.
    }
  };
}
