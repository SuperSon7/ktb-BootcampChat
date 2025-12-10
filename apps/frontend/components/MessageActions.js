import React, { useState, useCallback, useRef, useEffect } from "react";
import ReactDOM from "react-dom";
import { LikeIcon, CopyIcon } from "@vapor-ui/icons";
import { IconButton, VStack, HStack } from "@vapor-ui/core";
import EmojiPicker from "./EmojiPicker";
import { Toast } from "./Toast";

const MessageActions = ({
  messageId = "",
  messageContent = "",
  reactions = {},
  currentUserId = null,
  onReactionAdd = () => {},
  onReactionRemove = () => {},
  isMine = false,
  room = null,
}) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [tooltipStates, setTooltipStates] = useState({});
  const emojiPickerRef = useRef(null);
  const emojiButtonRef = useRef(null);
  const containerRef = useRef(null);
  const reactionRefs = useRef({});

  const handleClickOutside = useCallback((event) => {
    const isClickInside = emojiPickerRef.current?.contains(event.target);
    const isOnButton = emojiButtonRef.current?.contains(event.target);

    if (!isClickInside && !isOnButton) {
      setShowEmojiPicker(false);
    }
  }, []);

  useEffect(() => {
    if (showEmojiPicker) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showEmojiPicker, handleClickOutside]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(messageContent);
      Toast.success("메시지가 클립보드에 복사되었습니다.");
    } catch (e) {
      console.error("Copy failed:", e);
      Toast.error("메시지 복사에 실패했습니다.");
    }
  }, [messageContent]);

  const handleReactionSelect = useCallback(
    (emoji) => {
      const emojiChar = emoji.native || emoji;
      const reacted = reactions?.[emojiChar]?.includes(currentUserId);

      if (reacted) {
        onReactionRemove(messageId, emojiChar);
      } else {
        onReactionAdd(messageId, emojiChar);
      }
      setShowEmojiPicker(false);
    },
    [messageId, reactions, currentUserId, onReactionAdd, onReactionRemove]
  );

  const toggleTooltip = useCallback((emoji) => {
    setTooltipStates((prev) => ({ ...prev, [emoji]: !prev[emoji] }));
  }, []);

  const getReactionTooltip = useCallback(
    (emoji, userIds) => {
      if (!userIds || !room?.participants) return "";

      const participantMap = new Map(
        room.participants.map((p) => [String(p._id || p.id), p.name])
      );

      const names = userIds.map((id) => {
        const idStr = String(id);
        if (idStr === String(currentUserId)) return "나";
        return participantMap.get(idStr) || "알 수 없는 사용자";
      });

      return [...new Set(names)]
        .sort((a, b) => (a === "나" ? -1 : b === "나" ? 1 : a.localeCompare(b)))
        .join(", ");
    },
    [currentUserId, room]
  );

  const renderReactions = useCallback(() => {
    if (!reactions || Object.keys(reactions).length === 0) return null;

    return (
      <HStack gap="$050">
        {Object.entries(reactions).map(([emoji, users]) => {
          if (!reactionRefs.current[emoji]) {
            reactionRefs.current[emoji] = React.createRef();
          }

          return (
            <IconButton
              key={emoji}
              ref={reactionRefs.current[emoji]}
              size="sm"
              variant="ghost"
              className="flex items-center gap-1"
              onClick={() => handleReactionSelect(emoji)}
              onMouseEnter={() => toggleTooltip(emoji)}
              onMouseLeave={() => toggleTooltip(emoji)}
              aria-label="reaction button"
            >
              <span className="text-base">{emoji}</span>
              <span className="text-xs">{users.length}</span>
            </IconButton>
          );
        })}
      </HStack>
    );
  }, [reactions, handleReactionSelect, toggleTooltip]);

  const getEmojiPickerPosition = useCallback(() => {
    if (!emojiButtonRef.current) return { top: 0, left: 0 };

    const rect = emojiButtonRef.current.getBoundingClientRect();
    const pickerHeight = 350;
    const pickerWidth = 350;

    let top = rect.top - pickerHeight - 15;
    let left = rect.left;

    if (top < 10) top = rect.bottom + 15;
    if (left + pickerWidth > window.innerWidth) {
      left = window.innerWidth - pickerWidth - 10;
    }
    if (left < 10) left = 10;

    return { top, left };
  }, []);

  return (
    <div
      className={`flex flex-col gap-2 ${isMine ? "items-end" : "items-start"}`}
      ref={containerRef}
    >
      {renderReactions()}

      <HStack gap="$050">
        {/* Emoji Button */}
        <div className="relative">
          <IconButton
            ref={emojiButtonRef}
            size="sm"
            colorPalette={isMine ? "primary" : "contrast"}
            shape="square"
            variant="outline"
            onClick={() => setShowEmojiPicker((v) => !v)}
            aria-label="리액션 추가"
          >
            <LikeIcon size={16} />
          </IconButton>

          {showEmojiPicker &&
            typeof window !== "undefined" &&
            ReactDOM.createPortal(
              <div
                ref={emojiPickerRef}
                style={{
                  position: "fixed",
                  zIndex: 9999,
                  ...getEmojiPickerPosition(),
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700">
                  <EmojiPicker
                    onSelect={handleReactionSelect}
                    emojiSize={20}
                    perLine={8}
                    theme="light"
                  />
                </div>
              </div>,
              document.body
            )}
        </div>

        {/* Copy Button */}
        <IconButton
          size="sm"
          colorPalette={isMine ? "primary" : "contrast"}
          shape="square"
          variant="outline"
          onClick={handleCopy}
          aria-label="메시지 복사"
        >
          <CopyIcon size={16} />
        </IconButton>
      </HStack>
    </div>
  );
};

export default React.memo(MessageActions);
