import type { VideoProgress as VideoProgressType } from '../types';

interface VideoProgressProps {
  progress: VideoProgressType;
}

export function VideoProgress({ progress }: VideoProgressProps) {
  const { stage, percent, message } = progress;
  const isDone = stage === 'done';
  const isError = stage === 'error';

  return (
    <div className="dl-video-progress">
      <div className="dl-progress-bar">
        <div
          className={`dl-progress-fill${isDone ? ' dl-done' : ''}${isError ? ' dl-error' : ''}`}
          style={{ width: `${isDone || isError ? 100 : percent}%` }}
        />
      </div>
      <div className="dl-progress-text">{message}</div>
    </div>
  );
}
