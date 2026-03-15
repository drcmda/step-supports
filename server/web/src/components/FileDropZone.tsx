import { useState, useRef, useCallback } from 'react';

interface Props {
  onFile: (file: File) => void;
  disabled?: boolean;
}

const ACCEPTED = ['.stl', '.obj', '.step', '.stp'];

export default function FileDropZone({ onFile, disabled }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      const ext = '.' + file.name.toLowerCase().split('.').pop();
      if (!ACCEPTED.includes(ext)) {
        setError(`Unsupported format: ${ext}. Use STL, OBJ, or STEP files.`);
        return;
      }
      setError(null);
      setFileName(file.name);
      onFile(file);
    },
    [onFile]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile, disabled]
  );

  const onDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled) setIsDragging(true);
    },
    [disabled]
  );

  const onDragLeave = useCallback(() => setIsDragging(false), []);

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div>
      <div
        className={`drop-zone ${isDragging ? 'drop-zone--active' : ''} ${disabled ? 'drop-zone--disabled' : ''}`}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => !disabled && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".stl,.obj,.step,.stp"
          onChange={onChange}
          style={{ display: 'none' }}
        />
        <div className="drop-zone__icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        {fileName ? (
          <p className="drop-zone__file">{fileName}</p>
        ) : (
          <p className="drop-zone__text">
            Drop an STL, OBJ, or STEP file here, or <span className="drop-zone__browse">browse</span>
          </p>
        )}
      </div>
      {error && <p className="drop-zone__error">{error}</p>}
    </div>
  );
}
