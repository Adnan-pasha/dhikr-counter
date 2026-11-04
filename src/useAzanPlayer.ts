import React from 'react';
import { getAzanSource } from './azan';

export interface AzanPlayer {
  playing: boolean;
  error: string | null;
  play: () => void;
  stop: () => void;
}

/** Plays the bundled adhan. One at a time: starting again stops the one before. Leaving the screen stops it. */
export const useAzanPlayer = (soundId?: string): AzanPlayer => {
  const current = React.useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const stop = React.useCallback(() => {
    const audio = current.current;
    current.current = null;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setPlaying(false);
  }, []);

  const play = React.useCallback(() => {
    stop();
    setError(null);
    const audio = new Audio(getAzanSource(soundId).url);
    current.current = audio;
    audio.addEventListener('ended', () => {
      if (current.current === audio) {
        current.current = null;
        setPlaying(false);
      }
    });
    audio.play().then(
      () => { if (current.current === audio) setPlaying(true); },
      () => {
        if (current.current !== audio) return;
        current.current = null;
        setPlaying(false);
        setError('The adhan could not play. Tap the play button, and check your volume.');
      },
    );
  }, [soundId, stop]);

  React.useEffect(() => stop, [stop]);

  return { playing, error, play, stop };
};
