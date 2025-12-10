import { useCallback, useState } from "react";
import { Toast } from "../components/Toast";

export const useReactionHandling = (
  socketRef,
  currentUser,
  messages,
  setMessages
) => {
  const [pendingReactions] = useState(new Map());

  // -----------------------------------------------------
  // 🟢 공통: 메시지 객체를 안전하게 "딱 한 개만" 업데이트하는 함수
  // -----------------------------------------------------
  const updateSingleMessage = useCallback(
    (messageId, updater) => {
      setMessages((prev) => {
        const index = prev.findIndex((m) => m._id === messageId);
        if (index === -1) return prev;

        const oldMessage = prev[index];
        const updatedMessage = updater(oldMessage);

        // 메시지 변경이 없다면 (참조 동일) — 그대로 반환하여 리렌더 방지
        if (updatedMessage === oldMessage) return prev;

        const newMessages = [...prev];
        newMessages[index] = updatedMessage; // ← 단 하나만 변경

        return newMessages;
      });
    },
    [setMessages]
  );

  // -----------------------------------------------------
  // 🟢 리액션 추가
  // -----------------------------------------------------
  const handleReactionAdd = useCallback(
    async (messageId, reaction) => {
      try {
        if (!socketRef.current?.connected)
          throw new Error("Socket not connected");

        updateSingleMessage(messageId, (msg) => {
          const currentReactions = msg.reactions || {};
          const users = currentReactions[reaction] || [];

          // 이미 추가된 유저면 변경 없음 → 그대로 반환
          if (users.includes(currentUser.id)) return msg;

          return {
            ...msg,
            reactions: {
              ...currentReactions,
              [reaction]: [...users, currentUser.id],
            },
          };
        });

        socketRef.current.emit("messageReaction", {
          messageId,
          reaction,
          type: "add",
        });
      } catch (error) {
        console.error("Add reaction error:", error);
        Toast.error("리액션 추가에 실패했습니다.");

        // 롤백
        updateSingleMessage(
          messageId,
          () => messages.find((m) => m._id === messageId) || {}
        );
      }
    },
    [socketRef, currentUser, messages, updateSingleMessage]
  );

  // -----------------------------------------------------
  // 🟢 리액션 제거
  // -----------------------------------------------------
  const handleReactionRemove = useCallback(
    async (messageId, reaction) => {
      try {
        if (!socketRef.current?.connected)
          throw new Error("Socket not connected");

        updateSingleMessage(messageId, (msg) => {
          const currentReactions = msg.reactions || {};
          const users = currentReactions[reaction] || [];

          return {
            ...msg,
            reactions: {
              ...currentReactions,
              [reaction]: users.filter((id) => id !== currentUser.id),
            },
          };
        });

        socketRef.current.emit("messageReaction", {
          messageId,
          reaction,
          type: "remove",
        });
      } catch (error) {
        console.error("Remove reaction error:", error);
        Toast.error("리액션 제거에 실패했습니다.");

        updateSingleMessage(
          messageId,
          () => messages.find((m) => m._id === messageId) || {}
        );
      }
    },
    [socketRef, currentUser, messages, updateSingleMessage]
  );

  // -----------------------------------------------------
  // 🟢 서버에서 온 리액션 메시지 업데이트 처리
  // -----------------------------------------------------
  const handleReactionUpdate = useCallback(
    ({ messageId, reactions }) => {
      updateSingleMessage(messageId, (msg) => ({
        ...msg,
        reactions,
      }));
    },
    [updateSingleMessage]
  );

  return {
    handleReactionAdd,
    handleReactionRemove,
    handleReactionUpdate,
  };
};

export default useReactionHandling;
