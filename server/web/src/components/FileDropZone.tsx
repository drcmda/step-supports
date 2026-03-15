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
        className={`border-2 border-dashed rounded-xl py-12 px-6 text-center cursor-pointer transition-all mb-6 ${
          isDragging ? 'border-blue-500 bg-blue-500/5' : 'border-border hover:border-blue-500 hover:bg-blue-500/5'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
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
          className="hidden"
        />
        <div className="text-dim mb-4">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        {fileName ? (
          <p className="font-mono text-green-500 text-[0.95rem]">{fileName}</p>
        ) : (
          <p className="text-dim text-[0.95rem]">
            Drop an STL, OBJ, or STEP file here, or <span className="text-blue-500 underline">browse</span>
          </p>
        )}
      </div>
      {error && <p className="text-[#fca5a5] text-sm mt-2">{error}</p>}
    </div>
  );
}
