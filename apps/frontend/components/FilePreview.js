import React, { useEffect, useRef, useCallback, memo } from "react";
import {
  CloseOutlineIcon as X,
  ErrorCircleIcon as AlertCircle,
  ImageIcon,
  PdfIcon as FileText,
  MovieIcon as Film,
  LoadingOutlineIcon as Loader,
  MusicIcon as Music,
  FileIcon as File,
} from "@vapor-ui/icons";
import { Button, IconButton, Callout } from "@vapor-ui/core";
import fileService from "@/services/fileService";

const FilePreview = ({
  files = [],
  uploading = false,
  uploadProgress = 0,
  uploadError = null,
  onRemove,
  onRetry,
  onDrop,
  className = "",
  showFileName = true,
  showFileSize = true,
  variant = "default",
  previewSize = "md",
  allowPaste = true,
  maxFiles = 10,
}) => {
  const containerRef = useRef(null);
  const previewUrlsRef = useRef(new Map());
  const dragCounter = useRef(0);

  // 파일 객체 URL 정리를 위한 클린업
  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((url) => {
        URL.revokeObjectURL(url);
      });
      previewUrlsRef.current.clear();
    };
  }, []);

  // 파일 유효성 검사 및 처리를 위한 공통 함수
  const processFile = useCallback(async (file) => {
    try {
      const fileType = file?.type || "application/octet-stream";

      await fileService.validateFile(file);

      const [, subtype] = (fileType.includes("/") ? fileType : "/").split("/");
      const fileObject = {
        file,
        name: file.name || `file-${Date.now()}.${subtype || "bin"}`,
        type: fileType,
        size: file.size ?? 0,
      };

      const previewUrl = URL.createObjectURL(file);
      previewUrlsRef.current.set(fileObject.name, previewUrl);

      return fileObject;
    } catch (error) {
      console.error("File processing error:", error);
      throw error;
    }
  }, []);

  // 붙여넣기 이벤트 핸들러
  useEffect(() => {
    if (!allowPaste) return;

    const handlePaste = async (e) => {
      if (!containerRef.current?.contains(e.target)) return;
      if (files.length >= maxFiles) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      const fileItems = Array.from(items).filter(
        (item) =>
          item.kind === "file" &&
          (item.type?.startsWith("image/") ||
            item.type?.startsWith("video/") ||
            item.type?.startsWith("audio/") ||
            item.type === "application/pdf")
      );

      if (fileItems.length === 0) return;

      e.preventDefault();

      const availableSlots = maxFiles - files.length;
      const itemsToProcess = fileItems.slice(0, availableSlots);

      for (const item of itemsToProcess) {
        const file = item.getAsFile();
        if (!file) continue;

        try {
          const processedFile = await processFile(file);
          onDrop?.(processedFile);
        } catch (error) {
          console.error("Paste handling error:", error);
        }
      }
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [allowPaste, files.length, maxFiles, onDrop, processFile]);

  // 드래그 앤 드롭 이벤트 핸들러
  useEffect(() => {
    if (!containerRef.current || !onDrop) return;

    const handleDrop = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;

      containerRef.current.classList.remove("drag-over");

      if (files.length >= maxFiles) return;

      const droppedFiles = Array.from(e.dataTransfer.files).filter(
        (file) =>
          file.type?.startsWith("image/") ||
          file.type?.startsWith("video/") ||
          file.type?.startsWith("audio/") ||
          file.type === "application/pdf"
      );

      if (droppedFiles.length === 0) return;

      const availableSlots = maxFiles - files.length;
      const filesToProcess = droppedFiles.slice(0, availableSlots);

      for (const file of filesToProcess) {
        try {
          const processedFile = await processFile(file);
          onDrop(processedFile);
        } catch (error) {
          console.error("Drop handling error:", error);
        }
      }
    };

    const handleDragOver = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (files.length < maxFiles) {
        containerRef.current.classList.add("drag-over");
      }
    };

    const handleDragEnter = (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current++;
      if (dragCounter.current === 1 && files.length < maxFiles) {
        containerRef.current.classList.add("drag-over");
      }
    };

    const handleDragLeave = (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current--;
      if (dragCounter.current === 0) {
        containerRef.current.classList.remove("drag-over");
      }
    };

    const elem = containerRef.current;
    elem.addEventListener("drop", handleDrop);
    elem.addEventListener("dragover", handleDragOver);
    elem.addEventListener("dragenter", handleDragEnter);
    elem.addEventListener("dragleave", handleDragLeave);

    return () => {
      elem.removeEventListener("drop", handleDrop);
      elem.removeEventListener("dragover", handleDragOver);
      elem.removeEventListener("dragenter", handleDragEnter);
      elem.removeEventListener("dragleave", handleDragLeave);
    };
  }, [files.length, maxFiles, onDrop, processFile]);

  const getFileIcon = useCallback(
    (file) => {
      const iconProps = {
        size: variant === "compact" ? 20 : 24,
        className: "file-icon",
        "aria-hidden": true,
      };

      const fileType = file?.type || "";

      if (fileType.startsWith("image/")) {
        return <ImageIcon {...iconProps} color="#00C853" />;
      } else if (fileType.startsWith("video/")) {
        return <Film {...iconProps} color="#2196F3" />;
      } else if (fileType.startsWith("audio/")) {
        return <Music {...iconProps} color="#9C27B0" />;
      } else if (fileType === "application/pdf") {
        return <FileText {...iconProps} color="#F44336" />;
      } else {
        return <File {...iconProps} color="#757575" />;
      }
    },
    [variant]
  );

  const renderFilePreview = useCallback(
    (file) => {
      const previewUrl = previewUrlsRef.current.get(file.name);

      // 🔥 안전한 URL 생성
      const safeUrl = previewUrl || file.url || "";
      const fileType = file?.type || "";

      const previewContainer = "rounded-lg overflow-hidden relative";
      const previewBackground = "bg-transparent-pattern";

      if (fileType.startsWith("image/")) {
        return (
          <div className={`${previewContainer} ${previewBackground}`}>
            <img
              src={safeUrl}
              alt={`${file.name} 미리보기`}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "/placeholder-image.png";
                e.target.alt = "이미지 로드 실패";
              }}
              loading="lazy"
            />
          </div>
        );
      }

      if (fileType.startsWith("video/")) {
        return (
          <div className={`${previewContainer}`}>
            <video
              src={safeUrl}
              className="w-full h-full object-cover"
              controls={variant !== "compact"}
              controlsList="nodownload"
              preload="metadata"
            >
              <source src={safeUrl} type={fileType} />
              <track kind="captions" />
              비디오 미리보기를 지원하지 않는 브라우저입니다.
            </video>
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
              {getFileIcon(file)}
            </div>
          </div>
        );
      }

      return (
        <div
          className={`${previewContainer} flex flex-col items-center justify-center`}
          role="img"
          aria-label={`${file.name} 파일 아이콘`}
        >
          {getFileIcon(file)}
          {showFileName && (
            <span
              className="mt-2 text-xs text-gray-600 truncate"
              style={{ maxWidth: 80 }}
            >
              {(
                file.name?.split(".").pop() ||
                fileType.split("/")[1] ||
                "FILE"
              ).toUpperCase()}
            </span>
          )}
        </div>
      );
    },
    [variant, showFileName, getFileIcon]
  );

  const renderProgressBar = () => {
    if (!uploading) return null;

    return (
      <div
        className="mt-4 h-1 w-full bg-gray-200 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={uploadProgress}
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <div
          className="h-full bg-primary transition-all duration-300 ease-in-out"
          style={{ width: `${uploadProgress}%` }}
        />
      </div>
    );
  };

  const renderUploadStatus = useCallback(() => {
    if (uploadError) {
      return (
        <Callout color="danger" className="mt-2 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" aria-hidden="true" />
          <span className="flex-1">{uploadError}</span>
          {onRetry && (
            <Button size="sm" variant="outline" onClick={onRetry}>
              다시 시도
            </Button>
          )}
        </Callout>
      );
    }

    if (uploading) {
      return (
        <div className="mt-2 flex items-center gap-2 text-sm text-gray-600">
          <Loader className="w-4 h-4 animate-spin" aria-hidden="true" />
          <span>{uploadProgress}% 업로드 중...</span>
        </div>
      );
    }

    return null;
  }, [uploadError, uploading, uploadProgress, onRetry]);

  if (files.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className={`file-preview-scroll-container ${className} ${
        onDrop ? "cursor-pointer" : ""
      }`}
      role="region"
      aria-label="파일 미리보기"
    >
      <div className="file-preview-list">
        {files.map((file, index) => (
          <div key={`${file.name}-${index}`} className="file-preview-item">
            <div className="file-preview-content">
              {renderFilePreview(file)}

              <div className="flex-1 min-w-0">
                {showFileName && (
                  <div
                    className="text-sm font-medium truncate"
                    title={file.name}
                  >
                    {file.name}
                  </div>
                )}
                {showFileSize && (
                  <div className="text-xs text-gray-500 mt-1">
                    {fileService.formatFileSize(file.size)}
                  </div>
                )}
              </div>

              {variant !== "readonly" && (
                <div style={{ flexShrink: 0 }}>
                  {!uploading && onRemove && (
                    <IconButton
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const url = previewUrlsRef.current.get(file.name);
                        if (url) {
                          URL.revokeObjectURL(url);
                          previewUrlsRef.current.delete(file.name);
                        }
                        onRemove(file);
                      }}
                      title={`${file.name} 파일 제거`}
                      aria-label={`${file.name} 파일 제거`}
                    >
                      <X className="w-4 h-4" aria-hidden="true" />
                    </IconButton>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {renderProgressBar()}
      {renderUploadStatus()}

      {files.length >= maxFiles && (
        <Callout color="warning" className="file-limit-warning">
          <AlertCircle className="w-4 h-4" aria-hidden="true" />
          <span>파일은 최대 {maxFiles}개까지만 업로드할 수 있습니다.</span>
        </Callout>
      )}

      {onDrop && (
        <div
          className="absolute inset-0 bg-primary/10 border-2 border-primary border-dashed rounded-lg opacity-0 pointer-events-none transition-opacity drag-over:opacity-100"
          aria-hidden="true"
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-primary font-medium">
              파일을 여기에 놓으세요
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

FilePreview.defaultProps = {
  files: [],
  uploading: false,
  uploadProgress: 0,
  uploadError: null,
  showFileName: true,
  showFileSize: true,
  previewSize: "md",
  variant: "default",
  allowPaste: true,
  maxFiles: 10,
};

export default memo(FilePreview);
