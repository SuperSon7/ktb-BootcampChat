// MessageContext.js
import { createContext, useContext } from "react";

export const MessageContext = createContext(null);

// 전체 메시지 맵 반환
export const useMessagesMap = () => useContext(MessageContext);

// 특정 메시지만 safe하게 조회하는 헬퍼
export const getMessageById = (map, id) => map?.[id];
