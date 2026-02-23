import type { VideoData } from '../types';

interface VideoPreviewProps {
  data: VideoData;
}

export function VideoPreview({ data }: VideoPreviewProps) {
  const { src, poster, frameThumbnail, isBlob } = data;

  return (
    <div className="dl-video-thumb-wrap">
      {!isBlob && src ? (
        <video src={src} controls playsInline muted />
      ) : (
        <>
          {(frameThumbnail || poster) ? (
            <img src={frameThumbnail || poster} alt="Video" />
          ) : null}
        </>
      )}
      <div className="dl-video-badge">VIDEO</div>
    </div>
  );
}
