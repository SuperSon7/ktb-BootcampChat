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
    /** -----------------------------
     * 기본 Ref & 상태
     ------------------------------*/
    const messageInputRef = ref || useRef(null);
    const rawMessageRef = useRef(""); // 입력값 ref

    const submitLockRef = useRef(false);

    const lastSubmitRef = useRef({
      type: null,
      content: null,
      fileName: null,
      time: 0,
    });

    /** 파일 입력 Ref */
    const fileInputInternalRef = useRef(null);
    const fileInputElRef = fileInputRef || fileInputInternalRef;

    /** 파일 UI 상태 */
    const [files, setFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState(null);

    /** 멘션 상태 */
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [showMentionList, setShowMentionList] = useState(false);
    const [mentionIndex, setMentionIndex] = useState(0);
    const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
    const mentionFilterRef = useRef("");

    /** 안정적으로 유지해야 하는 함수 Ref */
    const onSubmitRef = useRef(onSubmit);
    const getFilteredRef = useRef(getFilteredParticipants);

    useEffect(() => {
      onSubmitRef.current = onSubmit;
    }, [onSubmit]);

    useEffect(() => {
      getFilteredRef.current = getFilteredParticipants;
    }, [getFilteredParticipants]);

    /** ---------------------------------
     *  파일 미리보기 + 검증
     ----------------------------------*/
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
          if (fileInputElRef.current) {
            fileInputElRef.current.value = "";
          }
        }
      },
      [onFileSelect, fileInputElRef]
    );

    const handleFileInputChange = useCallback(
      async (e) => {
        const file = e.target.files?.[0];
        await handleFileValidationAndPreview(file);
      },
      [handleFileValidationAndPreview]
    );

    /** ---------------------------------
     * 메시지 전송
     ----------------------------------*/
    const handleSubmit = useCallback(async () => {
      if (submitLockRef.current) return;
      submitLockRef.current = true;

      const submit = onSubmitRef.current;
      const text = (messageInputRef.current?.value || "").trim();
      const now = Date.now();

      try {
        /** FILE 메시지 */
        if (files.length > 0) {
          const duplicate =
            lastSubmitRef.current.type === "file" &&
            lastSubmitRef.current.fileName === files[0]?.name &&
            now - lastSubmitRef.current.time < 700;

          if (duplicate) return;

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

          messageInputRef.current.value = "";
          rawMessageRef.current = "";
          setFiles([]);
          return;
        }

        /** TEXT 메시지 */
        if (text) {
          const duplicate =
            lastSubmitRef.current.type === "text" &&
            lastSubmitRef.current.content === text &&
            now - lastSubmitRef.current.time < 700;

          if (duplicate) return;

          lastSubmitRef.current = {
            type: "text",
            content: text,
            fileName: null,
            time: now,
          };

          await submit({ type: "text", content: text });

          messageInputRef.current.value = "";
          rawMessageRef.current = "";
        }
      } finally {
        submitLockRef.current = false;
      }
    }, [files]);

    /** ---------------------------------
     * INPUT CHANGE (렌더링 없음)
     ----------------------------------*/
    const calculateMentionPosition = useCallback((textarea, index) => {
      const before = textarea.value.slice(0, index);
      const lines = before.split("\n");
      const line = lines[lines.length - 1];

      const measure = document.createElement("div");
      measure.style.visibility = "hidden";
      measure.style.position = "absolute";
      measure.style.whiteSpace = "pre";
      measure.style.font = window.getComputedStyle(textarea).font;
      measure.textContent = line;

      document.body.appendChild(measure);
      const width = measure.offsetWidth;
      document.body.removeChild(measure);

      const rect = textarea.getBoundingClientRect();
      const padLeft = parseInt(window.getComputedStyle(textarea).paddingLeft);
      const padTop = parseInt(window.getComputedStyle(textarea).paddingTop);
      const lineHeight = parseInt(window.getComputedStyle(textarea).lineHeight);

      return {
        left: rect.left + padLeft + width,
        top: rect.top + padTop + lineHeight * (lines.length - 1) + 35,
      };
    }, []);

    const handleInputChange = useCallback(
      (e) => {
        const value = e.target.value;
        rawMessageRef.current = value;

        const cursor = e.target.selectionStart;
        const before = value.slice(0, cursor);
        const lastAt = before.lastIndexOf("@");

        if (lastAt !== -1) {
          const filter = before.slice(lastAt + 1);

          if (!filter.includes(" ")) {
            mentionFilterRef.current = filter.toLowerCase();
            setShowMentionList(true);
            setMentionIndex(0);

            setMentionPosition(calculateMentionPosition(e.target, lastAt));
            return;
          }
        }

        setShowMentionList(false);
      },
      [calculateMentionPosition]
    );

    /** ---------------------------------
     * MENTION 필터링 (디바운스 없음)
     ----------------------------------*/
    const filteredParticipants = getFilteredRef.current(room)?.filter((u) => {
      const f = mentionFilterRef.current;
      return (
        u.name.toLowerCase().includes(f) || u.email.toLowerCase().includes(f)
      );
    });

    /** ---------------------------------
     * MENTION SELECT
     ----------------------------------*/
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

      /** 커서 위치 변경 */
      const pos = lastAt + mentionText.length;
      input.selectionStart = pos;
      input.selectionEnd = pos;

      rawMessageRef.current = newValue;
      setShowMentionList(false);
    }, []);

    /** ---------------------------------
     * KEY DOWN
     ----------------------------------*/
    const handleKeyDown = useCallback(
      (e) => {
        if (e.nativeEvent?.isComposing || e.isComposing) return;

        const list = filteredParticipants || [];

        if (showMentionList) {
          switch (e.key) {
            case "ArrowDown":
              e.preventDefault();
              setMentionIndex((i) => (i + 1) % list.length);
              return;

            case "ArrowUp":
              e.preventDefault();
              setMentionIndex((i) => (i - 1 + list.length) % list.length);
              return;

            case "Enter":
              e.preventDefault();
              handleSubmit();
              return;

            case "Escape":
              e.preventDefault();
              setShowMentionList(false);
              return;
          }
        }

        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          handleSubmit();
        }
      },
      [showMentionList, filteredParticipants, handleSubmit]
    );

    /** ---------------------------------
     * EMOJI SELECT
     ----------------------------------*/
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

      rawMessageRef.current = updated;
      setShowEmojiPicker(false);
    }, []);

    /** ---------------------------------
     * SEND DISABLED (디바운스 아님)
     ----------------------------------*/
    const isDisabledSend =
      disabled ||
      uploading ||
      externalUploading ||
      (!rawMessageRef.current.trim() && files.length === 0);

    /** ---------------------------------
     * RENDER
     ----------------------------------*/
    return (
      <>
        <Box className="relative" padding="$200 $400">
          {files.length > 0 && (
            <Box className="absolute bottom-full left-0 right-0 mb-2 z-1000">
              <FilePreview
                files={files}
                uploading={uploading}
                uploadError={uploadError}
                onRemove={(f) =>
                  setFiles((prev) => prev.filter((p) => p.name !== f.name))
                }
              />
            </Box>
          )}

          <VStack width="100%">
            <HStack>
              <Textarea
                ref={messageInputRef}
                data-testid="chat-message-input"
                onChange={handleInputChange}
                onKeyDownCapture={handleKeyDown}
                disabled={disabled}
                rows={1}
                autoResize
                placeholder="메시지를 입력하세요…"
              />

              <IconButton
                size="xl"
                data-testid="chat-send-button"
                disabled={disabled}
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
                disabled={disabled}
              >
                <LikeIcon />
              </IconButton>

              <IconButton
                variant="ghost"
                size="md"
                onClick={() => fileInputElRef.current?.click()}
                disabled={disabled}
              >
                <AttachFileOutlineIcon />
              </IconButton>

              <input
                data-testid="file-upload-input"
                ref={fileInputElRef}
                type="file"
                className="hidden"
                onChange={handleFileInputChange}
                disabled={disabled}
              />
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
            style={{
              top: mentionPosition.top,
              left: mentionPosition.left,
            }}
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
