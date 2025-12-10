import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  forwardRef,
  memo,
} from "react";
import { LikeIcon, AttachFileOutlineIcon, SendIcon } from "@vapor-ui/icons";
import { IconButton, VStack, HStack, Box, Textarea } from "@vapor-ui/core";
import EmojiPicker from "./EmojiPicker";
import MentionDropdown from "./MentionDropdown";
import FilePreview from "./FilePreview";
import fileService from "@/services/fileService";
import { useDebounce } from "@/hooks/useDebouce";

const ChatInput = forwardRef(
  (
    {
      onSubmit,
      onFileSelect,
      fileInputRef,
      disabled = false,
      uploading: externalUploading = false,
      room,
      getFilteredParticipants,
    },
    ref
  ) => {
    const messageInputRef = ref || useRef(null);
    const submitLockRef = useRef(false);
    const lastSubmitRef = useRef({
      type: null,
      content: null,
      fileName: null,
      time: 0,
    });

    // 최소 렌더링 state
    const [rawMessage, setRawMessage] = useState("");
    const debouncedMessage = useDebounce(rawMessage, 120);

    // 파일 UI state
    const [files, setFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadError, setUploadError] = useState(null);

    // 멘션 & 이모지 UI state
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showMentionList, setShowMentionList] = useState(false);
    const [mentionFilter, setMentionFilter] = useState("");
    const debouncedMention = useDebounce(mentionFilter, 120);
    const [mentionIndex, setMentionIndex] = useState(0);
    const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });

    const onSubmitRef = useRef(onSubmit);
    const getFilteredRef = useRef(getFilteredParticipants);

    useEffect(() => {
      onSubmitRef.current = onSubmit;
    }, [onSubmit]);

    useEffect(() => {
      getFilteredRef.current = getFilteredParticipants;
    }, [getFilteredParticipants]);

    // 파일 처리
    const handleFileValidationAndPreview = useCallback(
      async (file) => {
        if (!file) return;

        try {
          await fileService.validateFile(file);
          const preview = {
            file,
            url: URL.createObjectURL(file),
            name: file.name,
            size: file.size,
          };

          setFiles((prev) => [...prev, preview]);
          onFileSelect?.(file);
        } catch (err) {
          setUploadError(err.message);
        } finally {
          if (fileInputRef?.current) fileInputRef.current.value = "";
        }
      },
      [onFileSelect, fileInputRef]
    );

    // 메시지 제출
    const handleSubmit = useCallback(async () => {
      if (submitLockRef.current) return;

      submitLockRef.current = true;

      const submit = onSubmitRef.current;
      const textValue = messageInputRef.current?.value || "";
      const text = textValue.trim();

      try {
        const now = Date.now();

        if (files.length > 0) {
          const duplicateFile =
            lastSubmitRef.current.type === "file" &&
            lastSubmitRef.current.fileName === files[0]?.name &&
            now - lastSubmitRef.current.time < 700;
          if (duplicateFile) return;

          lastSubmitRef.current = {
            type: "file",
            content: text,
            fileName: files[0]?.name,
            time: now,
          };

          await submit({
            type: "file",
            content: text,
            fileData: files[0],
          });

          if (messageInputRef.current) messageInputRef.current.value = "";
          setRawMessage("");
          setFiles([]);
          return;
        }

        if (text) {
          const duplicateText =
            lastSubmitRef.current.type === "text" &&
            lastSubmitRef.current.content === text &&
            now - lastSubmitRef.current.time < 700;
          if (duplicateText) return;

          lastSubmitRef.current = {
            type: "text",
            content: text,
            fileName: null,
            time: now,
          };

          await submit({ type: "text", content: text });

          if (messageInputRef.current) messageInputRef.current.value = "";
          setRawMessage("");
        }
      } finally {
        submitLockRef.current = false;
      }
    }, [files]);

    // 입력 변경 핸들러
    const handleInputChange = useCallback((e) => {
      const value = e.target.value;
      setRawMessage(value);

      const cursor = e.target.selectionStart;
      const before = value.slice(0, cursor);
      const lastAt = before.lastIndexOf("@");

      if (lastAt !== -1) {
        const filter = before.slice(lastAt + 1);

        if (!filter.includes(" ")) {
          setMentionFilter(filter.toLowerCase());
          setShowMentionList(true);
          setMentionIndex(0);

          const pos = calculateMentionPosition(e.target, lastAt);
          setMentionPosition(pos);
          return;
        }
      }

      setShowMentionList(false);
    }, []);

    // 멘션 후보 필터링
    const filteredParticipants = getFilteredRef.current(room)?.filter((u) => {
      return (
        u.name.toLowerCase().includes(debouncedMention) ||
        u.email.toLowerCase().includes(debouncedMention)
      );
    });

    // 멘션 위치 계산
    const calculateMentionPosition = useCallback((textarea, index) => {
      const before = textarea.value.slice(0, index);
      const lines = before.split("\n");
      const lineIndex = lines.length - 1;

      const measure = document.createElement("div");
      measure.style.visibility = "hidden";
      measure.style.position = "absolute";
      measure.style.whiteSpace = "pre";
      measure.style.font = window.getComputedStyle(textarea).font;
      measure.textContent = lines[lineIndex];
      document.body.appendChild(measure);
      const width = measure.offsetWidth;
      document.body.removeChild(measure);

      const rect = textarea.getBoundingClientRect();
      const style = window.getComputedStyle(textarea);

      return {
        left: rect.left + parseInt(style.paddingLeft) + width,
        top:
          rect.top +
          parseInt(style.paddingTop) +
          lineIndex * (parseInt(style.lineHeight) || 20) +
          35,
      };
    }, []);

    // 🔥 멘션 선택 기능 추가
    const handleMentionSelect = useCallback((user) => {
      const input = messageInputRef.current;
      if (!input) return;

      const cursor = input.selectionStart;
      const value = input.value;

      const before = value.slice(0, cursor);
      const after = value.slice(cursor);

      const lastAt = before.lastIndexOf("@");

      if (lastAt === -1) return;

      const mentionText = `@${user.name} `;
      const newValue = before.slice(0, lastAt) + mentionText + after;

      input.value = newValue;

      const pos = lastAt + mentionText.length;
      input.selectionStart = pos;
      input.selectionEnd = pos;

      setRawMessage(newValue);
      setShowMentionList(false);
    }, []);

    // 🔥 Enter / 멘션 / Shift+Enter 처리
    const handleKeyDown = useCallback(
      (e) => {
        if (e.nativeEvent?.isComposing || e.isComposing) {
          return;
        }

        const list = filteredParticipants || [];

        // 멘션 리스트 열린 상태
        if (showMentionList) {
          switch (e.key) {
            case "ArrowDown":
              e.preventDefault();
              setMentionIndex((prev) => (prev + 1) % list.length);
              return;

            case "ArrowUp":
              e.preventDefault();
              setMentionIndex((prev) => (prev - 1 + list.length) % list.length);
              return;

            case "Enter":
              e.preventDefault();

              // 🔥 멘션 리스트 닫고 정상 입력 모드로 전환
              setShowMentionList(false);

              // 🔥 메시지 전송
              handleSubmit();
              return;

            case "Escape":
              e.preventDefault();
              setShowMentionList(false);
              return;
          }
        }

        // 🔥 일반 입력 모드에서 Enter → 메시지 전송
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          handleSubmit();
        }
      },
      [showMentionList, filteredParticipants, handleSubmit]
    );

    // 이모지 선택
    const handleEmojiSelect = useCallback((emoji) => {
      const input = messageInputRef.current;
      if (!input) return;

      const cursor = input.selectionStart;
      const value = input.value;

      const updated =
        value.slice(0, cursor) + emoji.native + value.slice(cursor);

      input.value = updated;
      input.selectionStart = cursor + emoji.native.length;
      input.selectionEnd = cursor + emoji.native.length;

      setRawMessage(updated);
      setShowEmojiPicker(false);
    }, []);

    const isDisabled = disabled || uploading || externalUploading;

    return (
      <>
        <Box className="relative" padding="$200 $400">
          {files.length > 0 && (
            <Box className="absolute bottom-full left-0 right-0 mb-2 z-1000">
              <FilePreview
                files={files}
                uploading={uploading}
                uploadProgress={uploadProgress}
                uploadError={uploadError}
                onRemove={(f) =>
                  setFiles((prev) => prev.filter((p) => p.name !== f.name))
                }
              />
            </Box>
          )}

          <VStack width="100%">
            <HStack>
              {/* 🔥 onKeyDownCapture 로 Enter 정상 처리 */}
              <Textarea
                ref={messageInputRef}
                onChange={handleInputChange}
                onKeyDownCapture={handleKeyDown}
                disabled={isDisabled}
                rows={1}
                autoResize
                placeholder="메시지를 입력하세요…"
              />

              <IconButton
                size="xl"
                disabled={
                  isDisabled || (!debouncedMessage.trim() && files.length === 0)
                }
                onClick={handleSubmit}
              >
                <SendIcon />
              </IconButton>
            </HStack>

            <HStack gap="$100">
              <IconButton
                variant="ghost"
                size="md"
                onClick={() => setShowEmojiPicker((v) => !v)}
                disabled={isDisabled}
              >
                <LikeIcon />
              </IconButton>

              <IconButton
                variant="ghost"
                size="md"
                onClick={() => fileInputRef?.current?.click()}
                disabled={isDisabled}
              >
                <AttachFileOutlineIcon />
              </IconButton>
            </HStack>

            {showEmojiPicker && (
              <Box className="absolute bottom-full left-0 z-1000">
                <EmojiPicker
                  onSelect={handleEmojiSelect}
                  perLine={8}
                  emojiSize={20}
                />
              </Box>
            )}
          </VStack>
        </Box>

        {showMentionList && (
          <Box
            className="fixed z-9999"
            style={{ top: mentionPosition.top, left: mentionPosition.left }}
          >
            <MentionDropdown
              participants={filteredParticipants}
              activeIndex={mentionIndex}
              onSelect={handleMentionSelect}
            />
          </Box>
        )}
      </>
    );
  }
);

export default memo(ChatInput);
