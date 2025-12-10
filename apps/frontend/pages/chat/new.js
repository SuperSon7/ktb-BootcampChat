import React, { useState, useRef } from "react";
import { useRouter } from "next/router";
import { ErrorCircleIcon } from "@vapor-ui/icons";
import {
  Box,
  Button,
  Field,
  Form,
  HStack,
  Switch,
  Text,
  TextInput,
  VStack,
  Callout,
} from "@vapor-ui/core";
import { useAuth } from "@/contexts/AuthContext";

function NewChatRoom() {
  const router = useRouter();
  const { user: currentUser } = useAuth();

  /** ⭐ 입력 값은 ref로 관리 → 입력 시 리렌더링 없음 */
  const nameRef = useRef("");
  const passwordRef = useRef("");

  /** 렌더링이 필요한 최소 상태들만 state로 유지 */
  const [hasPassword, setHasPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const joinRoom = async (roomId, password) => {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/rooms/${roomId}/join`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-auth-token": currentUser.token,
          "x-session-id": currentUser.sessionId,
        },
        body: JSON.stringify({ password }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message);
    }

    router.push(`/chat/${roomId}`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const nameValue = nameRef.current.trim();
    const passwordValue = hasPassword ? passwordRef.current : undefined;

    if (!nameValue) {
      setError("채팅방 이름을 입력해주세요.");
      return;
    }

    if (hasPassword && !passwordValue) {
      setError("비밀번호를 입력해주세요.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/rooms`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-auth-token": currentUser.token,
            "x-session-id": currentUser.sessionId,
          },
          body: JSON.stringify({
            name: nameValue,
            password: passwordValue,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message);
      }

      const { data } = await response.json();
      await joinRoom(data._id, passwordValue);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
      padding="$300"
    >
      <VStack
        gap="$400"
        width="400px"
        padding="$400"
        borderRadius="$300"
        border="1px solid var(--vapor-color-border-normal)"
        backgroundColor="var(--vapor-color-surface-raised)"
        render={<Form onSubmit={handleSubmit} />}
      >
        <Text typography="heading4">새 채팅방</Text>

        {error && (
          <Callout color="danger">
            <HStack gap="$200" alignItems="center">
              <ErrorCircleIcon size={16} />
              <Text>{error}</Text>
            </HStack>
          </Callout>
        )}

        <VStack gap="$300" width="100%">
          {/* 🔹 입력 값이 state가 아니라 ref → 리렌더링 없음 */}
          <Field.Root>
            <Box render={<Field.Label />} flexDirection="column">
              <Text typography="subtitle2" foreground="normal-200">
                채팅방 이름
              </Text>
              <TextInput
                id="room-name"
                data-testid="chat-room-name-input"
                size="lg"
                placeholder="채팅방 이름을 입력하세요"
                defaultValue=""
                onChange={(e) => (nameRef.current = e.target.value)}
                disabled={loading}
              />
            </Box>
          </Field.Root>

          <Field.Root>
            <HStack
              width="100%"
              justifyContent="space-between"
              render={<Field.Label />}
            >
              비밀번호 설정
              <Switch.Root
                id="room-password-toggle"
                checked={hasPassword}
                onCheckedChange={setHasPassword}
                disabled={loading}
              />
            </HStack>
          </Field.Root>

          {hasPassword && (
            <Field.Root>
              <Box render={<Field.Label />} flexDirection="column">
                <Text typography="subtitle2" foreground="normal-200">
                  비밀번호
                </Text>
                <TextInput
                  id="room-password"
                  type="password"
                  size="lg"
                  placeholder="비밀번호를 입력하세요"
                  defaultValue=""
                  onChange={(e) => (passwordRef.current = e.target.value)}
                  disabled={loading}
                />
              </Box>
            </Field.Root>
          )}

          <Button
            type="submit"
            size="lg"
            disabled={loading}
            data-testid="create-chat-room-button"
          >
            {loading ? "생성 중..." : "채팅방 만들기"}
          </Button>
        </VStack>
      </VStack>
    </Box>
  );
}

export default NewChatRoom;
