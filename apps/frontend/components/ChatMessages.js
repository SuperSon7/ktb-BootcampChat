import React, { useCallback, useMemo } from "react";
import { Text, VStack } from "@vapor-ui/core";
import SystemMessage from "./SystemMessage";
import FileMessage from "./FileMessage";
import UserMessage from "./UserMessage";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";
import { useAutoScroll } from "../hooks/useAutoScroll";

/* ------------------------------
   1. 서브 컴포넌트들은 그대로 메모
------------------------------ */
const LoadingIndicator = React.memo(() => (
  <div className="loading-messages">
    <div
      className="spinner-border spinner-border-sm text-primary"
      role="status"
    >
      <span className="visually-hidden">Loading...</span>
    </div>
    <span className="text-secondary text-sm">이전 메시지를 불러오는 중...</span>
  </div>
));
LoadingIndicator.displayName = "LoadingIndicator";

const MessageHistoryEnd = React.memo(() => (
  <div className="text-center p-2 mb-4" data-testid="message-history-end">
    <Text typography="body2" color="neutral-weak">
      더 이상 불러올 메시지가 없습니다.
    </Text>
  </div>
));
MessageHistoryEnd.displayName = "MessageHistoryEnd";

const EmptyMessages = React.memo(() => (
  <div className="empty-messages">
    <Text typography="body1">아직 메시지가 없습니다.</Text>
    <Text typography="body2" color="neutral-weak">
      첫 메시지를 보내보세요!
    </Text>
  </div>
));
EmptyMessages.displayName = "EmptyMessages";

/* ------------------------------
   2. 본체 컴포넌트
------------------------------ */
const ChatMessagesInner = ({
  messages = [],
  currentUser = null,
  room = null,
  loadingMessages = false,
  hasMoreMessages = true,
  onReactionAdd = () => {},
  onReactionRemove = () => {},
  onLoadMore = () => {},
  socketRef,
}) => {
  /* 2-1. currentUserId를 안정적인 primitive로 뽑기 */
  const currentUserId = useMemo(
    () => currentUser?.id || currentUser?._id || null,
    [currentUser]
  );

  /* 2-2. 무한 스크롤 훅 */
  const { sentinelRef } = useInfiniteScroll(
    onLoadMore,
    hasMoreMessages,
    loadingMessages
  );

  /* 2-3. 자동 스크롤 훅 (가능하면 messages 전체 대신 length만 넘기도록 훅을 수정하는 게 베스트) */
  const { containerRef } = useAutoScroll(
    messages,
    currentUserId,
    loadingMessages,
    100
  );

  /* 2-4. isMine 계산 콜백 (currentUserId만 의존) */
  const isMine = useCallback(
    (msg) => {
      if (!msg?.sender || !currentUserId) return false;

      const sender = msg.sender;
      const senderId =
        sender._id || sender.id || (typeof sender === "string" ? sender : null);

      return senderId === currentUserId;
    },
    [currentUserId]
  );

  /* 2-5. 메시지 리스트
     ✨ 여기에서 정렬은 "하지 않는다".
     - 서버 또는 상위 컴포넌트에서 이미 정렬된 배열을 내려준다고 가정.
     - 정말 정렬이 필요하면, messages를 setState 하는 곳에서 한 번만 정렬하는 게 맞음.
  */
  const stableMessages = useMemo(
    () => (Array.isArray(messages) ? messages : []),
    [messages]
  );

  /* 2-6. 메시지 렌더러
     - useCallback으로 고정
     - 각 Message 컴포넌트에는 `msg`뿐 아니라 공통 props만 전달 (지금 구조에서는 msg 전체를 넘기는 게 불가피하지만, memo가 먹도록 msg 불변성 유지가 중요)
  */
  const renderMessage = useCallback(
    (msg, idx) => {
      if (!msg) return null;

      const commonProps = {
        currentUser,
        room,
        onReactionAdd,
        onReactionRemove,
        socketRef,
      };

      const key = msg._id || msg.id || `msg-${idx}`;

      if (msg.type === "system") {
        return <SystemMessage key={key} msg={msg} />;
      }

      if (msg.type === "file") {
        return (
          <FileMessage
            key={key}
            {...commonProps}
            msg={msg}
            isMine={isMine(msg)}
          />
        );
      }

      return (
        <UserMessage
          key={key}
          {...commonProps}
          msg={msg}
          isMine={isMine(msg)}
        />
      );
    },
    [currentUser, room, onReactionAdd, onReactionRemove, socketRef, isMine]
  );

  return (
    <VStack
      ref={containerRef}
      gap="$200"
      className="h-full overflow-y-auto overflow-x-hidden scroll-smooth [overflow-scrolling:touch]"
      padding="$300"
      role="log"
      aria-live="polite"
      aria-atomic="false"
      data-testid="chat-messages-container"
    >
      {/* 상단 sentinel - 이전 메시지 로딩 */}
      {hasMoreMessages && (
        <div
          ref={sentinelRef}
          style={{
            height: "20px",
            margin: "10px 0",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {loadingMessages && <LoadingIndicator />}
        </div>
      )}

      {!hasMoreMessages && stableMessages.length > 0 && <MessageHistoryEnd />}

      {stableMessages.length === 0 ? (
        <EmptyMessages />
      ) : (
        stableMessages.map((msg, idx) => renderMessage(msg, idx))
      )}
    </VStack>
  );
};

/* ------------------------------
   3. React.memo + 커스텀 비교로
      쓸데없는 리렌더 차단
------------------------------ */
function areChatMessagesEqual(prev, next) {
  // messages는 "참조"만 비교 (불변성 유지가 전제)
  if (prev.messages !== next.messages) return false;

  const prevUserId = prev.currentUser?.id || prev.currentUser?._id;
  const nextUserId = next.currentUser?.id || next.currentUser?._id;

  if (prevUserId !== nextUserId) return false;

  const prevRoomId = prev.room?._id || prev.room?.id;
  const nextRoomId = next.room?._id || next.room?.id;

  if (prevRoomId !== nextRoomId) return false;

  if (prev.loadingMessages !== next.loadingMessages) return false;
  if (prev.hasMoreMessages !== next.hasMoreMessages) return false;

  // onReactionAdd / onReactionRemove / onLoadMore / socketRef 는
  // 상위에서 useCallback/ useRef 로 고정해준다는 가정
  if (prev.onReactionAdd !== next.onReactionAdd) return false;
  if (prev.onReactionRemove !== next.onReactionRemove) return false;
  if (prev.onLoadMore !== next.onLoadMore) return false;
  if (prev.socketRef !== next.socketRef) return false;

  return true;
}

const ChatMessages = React.memo(ChatMessagesInner, areChatMessagesEqual);
ChatMessages.displayName = "ChatMessages";

export default ChatMessages;
