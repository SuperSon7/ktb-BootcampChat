import React, {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from "react";
import ReactDOM from "react-dom";
import { LikeIcon, CopyIcon } from "@vapor-ui/icons";
import { IconButton, HStack } from "@vapor-ui/core";
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

  // 🔹 외부 클릭 감지
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

  // 🔹 메시지 복사
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(messageContent);
      Toast.success("메시지가 클립보드에 복사되었습니다.");
    } catch (e) {
      console.error("Copy failed:", e);
      Toast.error("메시지 복사에 실패했습니다.");
    }
  }, [messageContent]);

  // 🔹 리액션 선택 (이모지 피커 + 버튼 공통)
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

  // (필요하면 title 등으로 사용할 수 있는 함수 – 지금은 사용 X)
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

  // ✅ 리액션 버튼 리스트는 reactions 바뀔 때만 다시 생성
  const reactionsNode = useMemo(() => {
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
              {/* Vapor IconButton children은 하나여야 해서 div로 래핑 */}
              <div className="flex items-center gap-1">
                <span className="text-base">{emoji}</span>
                <span className="text-xs">{users.length}</span>
              </div>
            </IconButton>
          );
        })}
      </HStack>
    );
  }, [reactions, handleReactionSelect, toggleTooltip]);

  // 🔹 이모지 피커 위치 계산
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
      {reactionsNode}

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

// ✅ 이 메시지 액션 컴포넌트도 memo + 커스텀 비교
function areMessageActionsEqual(prev, next) {
  return (
    prev.messageId === next.messageId &&
    prev.messageContent === next.messageContent &&
    prev.currentUserId === next.currentUserId &&
    prev.isMine === next.isMine &&
    prev.room === next.room &&
    prev.reactions === next.reactions // reactions 참조가 바뀐 메시지만 리렌더
  );
}

export default React.memo(MessageActions, areMessageActionsEqual);
