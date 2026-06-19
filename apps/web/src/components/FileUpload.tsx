import { useRef, useState } from 'react';
import { api } from '../api';

interface Props {
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  folder: string;
  accept?: string;
  /** Show image thumbnail when the value is a URL. Defaults to true for image/* accept. */
  imagePreview?: boolean;
  disabled?: boolean;
}

export function FileUpload({ value, onChange, folder, accept = '*/*', imagePreview, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const isImage = imagePreview ?? accept.includes('image');
  const isUrl = value?.startsWith('http');

  const handleFile = async (file: File) => {
    setError('');
    setUploading(true);
    setProgress(0);
    try {
      const url = await api.storage.upload(file, folder, setProgress);
      onChange(url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const handleClear = async () => {
    if (value?.startsWith('http')) {
      try {
        const key = new URL(value).pathname.slice(1);
        await api.storage.deleteFile(key);
      } catch { /* best-effort */ }
    }
    onChange(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-1.5">
      {/* Current file preview */}
      {isUrl && value && (
        <div className="relative group inline-block">
          {isImage ? (
            <img src={value} alt="Uploaded" className="w-20 h-20 rounded-xl object-cover border border-slate-200 shadow-sm" />
          ) : (
            <a href={value} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-sky-600 hover:underline bg-sky-50 border border-sky-100 rounded-lg px-3 py-2 max-w-xs truncate">
              <i className="fas fa-file-alt flex-shrink-0" />
              <span className="truncate">{value.split('/').pop()?.split('?')[0] ?? 'View file'}</span>
            </a>
          )}
          {!disabled && (
            <button type="button" onClick={handleClear}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center shadow hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
              <i className="fas fa-times" />
            </button>
          )}
        </div>
      )}

      {/* Upload drop zone (shown when no file yet) */}
      {!isUrl && !uploading && (
        <div
          onClick={() => !disabled && inputRef.current?.click()}
          onDrop={e => { e.preventDefault(); !disabled && e.dataTransfer.files[0] && handleFile(e.dataTransfer.files[0]); }}
          onDragOver={e => e.preventDefault()}
          className={`border-2 border-dashed rounded-xl px-3 py-4 flex flex-col items-center gap-1.5 transition-colors ${
            disabled ? 'border-slate-100 bg-slate-50 cursor-not-allowed' :
            'border-slate-200 hover:border-sky-300 hover:bg-sky-50/50 cursor-pointer'
          }`}
        >
          <i className={`text-xl text-slate-300 ${isImage ? 'fas fa-camera' : 'fas fa-cloud-upload-alt'}`} />
          <p className="text-xs text-slate-400 text-center">
            {disabled ? 'Upload disabled' : <><span className="text-sky-500 font-medium">Click</span> or drag &amp; drop</>}
          </p>
        </div>
      )}

      {/* Progress bar */}
      {uploading && (
        <div className="flex flex-col items-center gap-1.5 py-3">
          <i className="fas fa-circle-notch fa-spin text-sky-500" />
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-sky-500 rounded-full transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <span className="text-xs text-sky-500">{Math.round(progress * 100)}%</span>
        </div>
      )}

      {/* Replace / change link shown below an existing file */}
      {isUrl && !uploading && !disabled && (
        <button type="button" onClick={() => inputRef.current?.click()}
          className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
          <i className="fas fa-redo text-xs" /> Replace
        </button>
      )}

      {error && <p className="text-xs text-red-500 flex items-center gap-1"><i className="fas fa-exclamation-circle" />{error}</p>}

      <input ref={inputRef} type="file" accept={accept} className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
    </div>
  );
}
