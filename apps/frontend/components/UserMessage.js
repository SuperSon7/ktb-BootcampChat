import React, { useRef, useMemo } from "react";
import { VStack, HStack } from "@vapor-ui/core";
import MessageContent from "./MessageContent";
import MessageActions from "./MessageActions";
import CustomAvatar from "./CustomAvatar";
import ReadStatus from "./ReadStatus";

const UserMessage = ({
  msg,
  isMine,
  currentUser,
  onReactionAdd,
  onReactionRemove,
  room,
  socketRef,
}) => {
  const messageDomRef = useRef(null);

  const currentUserId = currentUser?._id || currentUser?.id;

  // 내가 읽은 메시지는 항상 읽음으로 간주
  const normalizedReaders = useMemo(() => {
    const r = msg.readers || [];
    return r.includes(currentUserId) ? r : [...r, currentUserId];
  }, [msg.readers, currentUserId]);

  const formattedTime = useMemo(() => {
    if (!msg.timestamp) return "";
    return new Date(msg.timestamp).toLocaleString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  }, [msg.timestamp]);

  const user = useMemo(
    () => (isMine ? currentUser : msg.sender),
    [isMine, currentUser, msg.sender]
  );

  return (
    <div className="my-4" ref={messageDomRef} data-testid="message-container">
      <VStack
        className={`max-w-[65%] ${
          isMine ? "ml-auto items-end" : "mr-auto items-start"
        }`}
        gap="$100"
        align={isMine ? "flex-end" : "flex-start"}
      >
        <HStack gap="$100" alignItems="center" className="px-1">
          <CustomAvatar user={user} size="lg" persistent showInitials />
          <span className="text-sm font-medium text-gray-300">
            {isMine ? "나" : msg.sender?.name}
          </span>
        </HStack>

        <div
          className={`relative group rounded-2xl px-4 py-3 border transition-all duration-200 ${
            isMine
              ? "bg-gray-800 border-blue-500 hover:border-blue-400 hover:shadow-md"
              : "bg-transparent border-gray-400 hover:border-gray-300 hover:shadow-md"
          }`}
        >
          <div
            className={`text-base leading-relaxed ${
              isMine ? "text-blue-100" : "text-white"
            }`}
            data-testid="message-content"
          >
            <MessageContent content={msg.content} />
          </div>

          <HStack
            gap="$150"
            justifyContent="flex-end"
            alignItems="center"
            className={`mt-2 pt-2 border-t ${
              isMine ? "border-gray-700" : "border-gray-600"
            }`}
          >
            <div
              className={`text-xs ${
                isMine ? "text-blue-400" : "text-gray-300"
              }`}
            >
              {formattedTime}
            </div>

            <ReadStatus
              messageType={msg.type}
              participants={room?.participants || []}
              readers={normalizedReaders}
              messageId={msg._id}
              messageRef={messageDomRef}
              currentUserId={currentUserId}
              socketRef={socketRef}
            />
          </HStack>
        </div>

        <MessageActions
          messageId={msg._id}
          messageContent={msg.content}
          reactions={msg.reactions}
          currentUserId={currentUserId}
          onReactionAdd={onReactionAdd}
          onReactionRemove={onReactionRemove}
          isMine={isMine}
          room={room}
        />
      </VStack>
    </div>
  );
};

/* -------------------------------------------------------
   가장 강력하고 실용적인 비교 함수 → 참조 안정성 필수
------------------------------------------------------- */

function areUserMessageEqual(prev, next) {
  return prev.msg === next.msg;
}

export default React.memo(UserMessage, areUserMessageEqual);
