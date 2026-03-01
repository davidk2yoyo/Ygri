import React, { useRef, useState } from "react";

export default function FileUpload({ onFileSelect, accept = "*", multiple = false, className = "" }) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  const handleFiles = (files) => {
    if (multiple) {
      onFileSelect(Array.from(files));
    } else {
      onFileSelect(files[0]);
    }
  };

  const onButtonClick = () => {
    inputRef.current?.click();
  };

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={accept}
        onChange={handleChange}
        className="hidden"
      />

      <div
        onClick={onButtonClick}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
          ${dragActive
            ? "border-primary bg-primary/5 dark:bg-primary/10"
            : "border-bgray-300 dark:border-darkblack-400 hover:border-primary/50 hover:bg-bgray-50 dark:hover:bg-darkblack-500"
          }
        `}
      >
        <div className="flex flex-col items-center gap-3">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
            dragActive ? "bg-primary text-white" : "bg-bgray-100 dark:bg-darkblack-500 text-bgray-500"
          }`}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>

          <div>
            <p className="text-sm font-medium text-darkblack-700 dark:text-white mb-1">
              {dragActive ? "Drop file here" : "Drop file or click to browse"}
            </p>
            <p className="text-xs text-bgray-500 dark:text-bgray-400">
              {accept === "*" ? "Any file type" : accept} • {multiple ? "Multiple files" : "Single file"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
