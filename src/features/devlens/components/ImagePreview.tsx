interface ImagePreviewProps {
  src: string;
  thumbDataUrl?: string;
}

export function ImagePreview({ src, thumbDataUrl }: ImagePreviewProps) {
  return (
    <div className="dl-thumb-wrap">
      <img src={thumbDataUrl || src} alt="Preview" />
    </div>
  );
}
