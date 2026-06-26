import { UploadCloud } from "lucide-react";
import type { ChangeEvent } from "react";
import { useState } from "react";

type FileDropzoneProps = {
  accept: string;
  disabled?: boolean;
  label: string;
  helper: string;
  onFileSelected: (file: File | File[]) => void;
  multiple?: boolean;
};

export function FileDropzone({ accept, disabled, label, helper, onFileSelected, multiple = false }: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      if (multiple) {
        onFileSelected(Array.from(files));
      } else {
        onFileSelected(files[0]!);
      }
    }
    event.target.value = "";
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      if (multiple) {
        onFileSelected(Array.from(files));
      } else {
        onFileSelected(files[0]!);
      }
    }
  };

  return (
    <label
      className={`dropzone ${disabled ? "disabled" : ""} ${isDragging ? "dragging" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <UploadCloud aria-hidden="true" size={26} />
      <strong>{label}</strong>
      <span>{helper}</span>
      <input accept={accept} disabled={disabled} type="file" onChange={handleChange} multiple={multiple} />
    </label>
  );
}
