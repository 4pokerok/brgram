import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { useAuthStore } from "./store/useAuth";
import { apiFetch } from "./lib/api";
import { connectSocket, disconnectSocket } from "./lib/socket";
import {
  MAX_CHAT_FILE_SIZE_BYTES,
  normalizeAttachmentName,
  type UploadedAttachment,
} from "./lib/attachments";
import type {
  Channel,
  DirectChat,
  DirectMessage,
  FriendsResponse,
  Message,
  MessageAttachment,
  PublicUserProfile,
  User,
  VoiceParticipant,
} from "./types";
import { AuthForm } from "./components/AuthForm";
import { ChannelSidebar } from "./components/ChannelSidebar";
import { ChatView } from "./components/ChatView";
import { SettingsModal } from "./components/SettingsModal";
import { DirectChatView } from "./components/DirectChatView";
import { UserProfileModal } from "./components/UserProfileModal";
import { ChannelInviteModal } from "./components/ChannelInviteModal";
import { ActiveCallBar } from "./components/ActiveCallBar";

type VoiceSignalPayload = {
  type: "offer" | "answer" | "candidate";
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
};

type IncomingCallPayload = {
  roomId: string;
  kind: "CHANNEL" | "DM";
  fromUserId: string;
  fromUsername: string;
  channelId?: string;
  directChatId?: string;
};

type MessageToast = {
  id: string;
  title: string;
  body: string;
};

type StoredSelectedRoom = {
  kind: "DM" | "CHANNEL";
  id: string;
};

type Theme = "light" | "dark";
type Language = "ru" | "en";
type FontSize = "sm" | "md" | "lg";

const NOTIFICATION_SOUND_PATH = "/sounds/notification.mp3";
const INCOMING_CALL_SOUND_PATH = "/sounds/call.mp3";

const UI_TEXT: Record<
  Language,
  {
    textChannels: string;
    voiceChannels: string;
    friends: string;
    requests: string;
    blockedUsers: string;
    directChats: string;
    settings: string;
    logout: string;
    emptyState: string;
    chatFallback: string;
    you: string;
    send: string;
    attachFile: string;
    removeFile: string;
    uploadingFile: string;
    fileLabel: string;
    fileTooLargeError: string;
    fileUploadFailed: string;
    messagePlaceholder: string;
    voiceFallback: string;
    voiceConnectedHint: string;
    voiceJoinHint: string;
    leaveVoice: string;
    joinVoice: string;
    participants: string;
    incomingCallTitle: string;
    incomingCallMessage: (username: string) => string;
    answerCall: string;
    declineCall: string;
    alreadyInCall: string;
    activeCallFallback: string;
    muteMicrophone: string;
    unmuteMicrophone: string;
    deleteConfirm: (name: string) => string;
    deleteChannel: string;
    leaveGroup: string;
    leaveGroupConfirm: (name: string) => string;
    createTextPrompt: string;
    createVoicePrompt: string;
    addFriendPrompt: string;
    addFriend: string;
    openChat: string;
    accept: string;
    decline: string;
    outgoing: string;
    descriptionPrompt: string;
    settingsTitle: string;
    profileSectionTitle: string;
    profileUsername: string;
    profileAvatarUrl: string;
    profileAvatarDrop: string;
    profileAvatarChoose: string;
    profileAvatarRemove: string;
    profileAvatarHint: string;
    profileBio: string;
    profileSave: string;
    profileSaving: string;
    userProfileTitle: string;
    openProfile: string;
    blockUser: string;
    unblockUser: string;
    removeFriend: string;
    blockSaving: string;
    channelAvatarChange: string;
    channelAvatarRemove: string;
    channelInvite: string;
    channelInviteTitle: string;
    channelInviteEmpty: string;
    close: string;
    theme: string;
    notifications: string;
    callSounds: string;
    enabled: string;
    disabled: string;
    light: string;
    dark: string;
    language: string;
    fontSize: string;
    fontSmall: string;
    fontMedium: string;
    fontLarge: string;
    languageRu: string;
    languageEn: string;
    muteChatNotifications: string;
    unmuteChatNotifications: string;
  }
> = {
  ru: {
    textChannels: "Чаты",
    voiceChannels: "Голос",
    friends: "Друзья",
    requests: "Заявки",
    blockedUsers: "Заблокированные",
    directChats: "Личные чаты",
    settings: "Настройки",
    logout: "Выйти",
    emptyState: "Создай или выбери канал",
    chatFallback: "Текстовый канал",
    you: "Вы",
    send: "Отправить",
    attachFile: "Прикрепить файл",
    removeFile: "Убрать файл",
    uploadingFile: "Загрузка файла...",
    fileLabel: "Файл",
    fileTooLargeError: "Файл слишком большой. Максимум 25 MB.",
    fileUploadFailed: "Не удалось загрузить файл",
    messagePlaceholder: "Сообщение",
    voiceFallback: "Голосовой канал",
    voiceConnectedHint: "Вы подключены. Держите вкладку активной для стабильного качества.",
    voiceJoinHint: "Нажмите «Войти в голос», чтобы подключить микрофон.",
    leaveVoice: "Завершить звонок",
    joinVoice: "Позвонить",
    participants: "Участники",
    incomingCallTitle: "Входящий звонок",
    incomingCallMessage: (username: string) => `${username} звонит`,
    answerCall: "Ответить",
    declineCall: "Сбросить",
    alreadyInCall: "Вы уже в звонке в другом чате",
    activeCallFallback: "Активный звонок",
    muteMicrophone: "Выключить микрофон",
    unmuteMicrophone: "Включить микрофон",
    deleteConfirm: (name: string) => `Удалить группу "${name}"?`,
    deleteChannel: "Удалить группу",
    leaveGroup: "Выйти из группы",
    leaveGroupConfirm: (name: string) => `Выйти из группы "${name}"?`,
    createTextPrompt: "Название текстового канала",
    createVoicePrompt: "Название голосового канала",
    addFriendPrompt: "Имя пользователя друга",
    addFriend: "Добавить друга",
    openChat: "Открыть чат",
    accept: "Принять",
    decline: "Отклонить",
    outgoing: "исходящая",
    descriptionPrompt: "Описание (необязательно)",
    settingsTitle: "Настройки",
    profileSectionTitle: "Профиль",
    profileUsername: "Ник",
    profileAvatarUrl: "Ссылка на аватар",
    profileAvatarDrop: "Перетащи фото сюда",
    profileAvatarChoose: "Выбрать файл",
    profileAvatarRemove: "Убрать",
    profileAvatarHint: "PNG/JPG/WEBP до 2MB",
    profileBio: "Описание",
    profileSave: "Сохранить профиль",
    profileSaving: "Сохранение...",
    userProfileTitle: "Профиль пользователя",
    openProfile: "Открыть профиль",
    blockUser: "Заблокировать",
    unblockUser: "Разблокировать",
    removeFriend: "Удалить из друзей",
    blockSaving: "Сохранение...",
    channelAvatarChange: "Сменить аватар",
    channelAvatarRemove: "Убрать аватар",
    channelInvite: "Пригласить",
    channelInviteTitle: "Пригласить друзей",
    channelInviteEmpty: "Нет друзей для приглашения",
    close: "Закрыть",
    theme: "Тема",
    notifications: "Уведомления",
    callSounds: "Звук звонков",
    enabled: "Вкл",
    disabled: "Выкл",
    light: "Светлая",
    dark: "Тёмная",
    language: "Язык",
    fontSize: "Размер шрифта",
    fontSmall: "Маленький",
    fontMedium: "Средний",
    fontLarge: "Большой",
    languageRu: "Русский",
    languageEn: "English",
    muteChatNotifications: "Выключить уведомления чата",
    unmuteChatNotifications: "Включить уведомления чата",
  },
  en: {
    textChannels: "Chats",
    voiceChannels: "Voice",
    friends: "Friends",
    requests: "Requests",
    blockedUsers: "Blocked users",
    directChats: "Direct chats",
    settings: "Settings",
    logout: "Logout",
    emptyState: "Create or choose a channel",
    chatFallback: "Text channel",
    you: "You",
    send: "Send",
    attachFile: "Attach file",
    removeFile: "Remove file",
    uploadingFile: "Uploading file...",
    fileLabel: "File",
    fileTooLargeError: "File is too large. Max 25 MB.",
    fileUploadFailed: "Failed to upload file",
    messagePlaceholder: "Message",
    voiceFallback: "Voice channel",
    voiceConnectedHint: "You are connected. Keep this tab active for stable voice quality.",
    voiceJoinHint: "Click Join Voice to connect your microphone.",
    leaveVoice: "Hang up",
    joinVoice: "Call",
    participants: "Participants",
    incomingCallTitle: "Incoming call",
    incomingCallMessage: (username: string) => `${username} is calling`,
    answerCall: "Answer",
    declineCall: "Decline",
    alreadyInCall: "You are already in another call",
    activeCallFallback: "Active call",
    muteMicrophone: "Mute microphone",
    unmuteMicrophone: "Unmute microphone",
    deleteConfirm: (name: string) => `Delete group "${name}"?`,
    deleteChannel: "Delete group",
    leaveGroup: "Leave group",
    leaveGroupConfirm: (name: string) => `Leave group "${name}"?`,
    createTextPrompt: "Text channel name",
    createVoicePrompt: "Voice channel name",
    addFriendPrompt: "Friend username",
    addFriend: "Add friend",
    openChat: "Open chat",
    accept: "Accept",
    decline: "Decline",
    outgoing: "outgoing",
    descriptionPrompt: "Description (optional)",
    settingsTitle: "Settings",
    profileSectionTitle: "Profile",
    profileUsername: "Nickname",
    profileAvatarUrl: "Avatar URL",
    profileAvatarDrop: "Drop image here",
    profileAvatarChoose: "Choose file",
    profileAvatarRemove: "Remove",
    profileAvatarHint: "PNG/JPG/WEBP up to 2MB",
    profileBio: "Description",
    profileSave: "Save profile",
    profileSaving: "Saving...",
    userProfileTitle: "User profile",
    openProfile: "Open profile",
    blockUser: "Block",
    unblockUser: "Unblock",
    removeFriend: "Remove friend",
    blockSaving: "Saving...",
    channelAvatarChange: "Change avatar",
    channelAvatarRemove: "Remove avatar",
    channelInvite: "Invite",
    channelInviteTitle: "Invite friends",
    channelInviteEmpty: "No friends to invite",
    close: "Close",
    theme: "Theme",
    notifications: "Notifications",
    callSounds: "Call sounds",
    enabled: "On",
    disabled: "Off",
    light: "Light",
    dark: "Dark",
    language: "Language",
    fontSize: "Font size",
    fontSmall: "Small",
    fontMedium: "Medium",
    fontLarge: "Large",
    languageRu: "Русский",
    languageEn: "English",
    muteChatNotifications: "Mute chat notifications",
    unmuteChatNotifications: "Unmute chat notifications",
  },
};

function getDirectChatTimestamp(chat: DirectChat): number {
  const rawValue = chat.lastMessage?.createdAt ?? chat.updatedAt ?? chat.createdAt;
  const parsed = Date.parse(rawValue);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function sortDirectChats(chats: DirectChat[]): DirectChat[] {
  return [...chats].sort((left, right) => getDirectChatTimestamp(right) - getDirectChatTimestamp(left));
}

function getMessagePreview(content: string, attachment: MessageAttachment | null | undefined, fileLabel: string): string {
  const normalizedContent = content.trim();
  if (normalizedContent.length > 0) return normalizedContent;
  if (attachment?.name) return `${fileLabel}: ${attachment.name}`;
  return fileLabel;
}

export function App() {
  const token = useAuthStore((state) => state.token);
  const me = useAuthStore((state) => state.user);
  const setAuth = useAuthStore((state) => state.setAuth);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [channelAttachment, setChannelAttachment] = useState<MessageAttachment | null>(null);
  const [channelAttachmentUploading, setChannelAttachmentUploading] = useState(false);

  const [friends, setFriends] = useState<User[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<User[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendsResponse["incomingRequests"]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendsResponse["outgoingRequests"]>([]);

  const [directChats, setDirectChats] = useState<DirectChat[]>([]);
  const [selectedDirectChatId, setSelectedDirectChatId] = useState<string | null>(null);
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);
  const [directDraft, setDirectDraft] = useState("");
  const [directAttachment, setDirectAttachment] = useState<MessageAttachment | null>(null);
  const [directAttachmentUploading, setDirectAttachmentUploading] = useState(false);
  const [incomingCall, setIncomingCall] = useState<IncomingCallPayload | null>(null);
  const [messageToasts, setMessageToasts] = useState<MessageToast[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "light";

    const savedTheme = window.localStorage.getItem("brgram-theme");
    if (savedTheme === "light" || savedTheme === "dark") return savedTheme;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [language, setLanguage] = useState<Language>(() => {
    if (typeof window === "undefined") return "ru";
    const savedLanguage = window.localStorage.getItem("brgram-language");
    return savedLanguage === "en" || savedLanguage === "ru" ? savedLanguage : "ru";
  });
  const [fontSize, setFontSize] = useState<FontSize>(() => {
    if (typeof window === "undefined") return "md";
    const savedFontSize = window.localStorage.getItem("brgram-font-size");
    return savedFontSize === "sm" || savedFontSize === "md" || savedFontSize === "lg" ? savedFontSize : "md";
  });
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem("brgram-notifications-enabled") !== "false";
  });
  const [callSoundsEnabled, setCallSoundsEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem("brgram-call-sounds-enabled") !== "false";
  });
  const [mutedRoomIds, setMutedRoomIds] = useState<string[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileUsername, setProfileUsername] = useState("");
  const [profileAvatarUrl, setProfileAvatarUrl] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [userProfileOpen, setUserProfileOpen] = useState(false);
  const [userProfileLoading, setUserProfileLoading] = useState(false);
  const [userProfileActionSaving, setUserProfileActionSaving] = useState(false);
  const [selectedUserProfile, setSelectedUserProfile] = useState<PublicUserProfile | null>(null);
  const [channelInviteOpen, setChannelInviteOpen] = useState(false);
  const [channelInviteLoading, setChannelInviteLoading] = useState(false);
  const [channelInviteMembers, setChannelInviteMembers] = useState<User[]>([]);
  const [channelInviteSendingUserId, setChannelInviteSendingUserId] = useState<string | null>(null);

  const [voiceParticipants, setVoiceParticipants] = useState<VoiceParticipant[]>([]);
  const [activeVoiceChannelId, setActiveVoiceChannelId] = useState<string | null>(null);
  const [activeCallInitiatorId, setActiveCallInitiatorId] = useState<string | null>(null);
  const [voiceConnected, setVoiceConnected] = useState(false);
  const [microphoneMuted, setMicrophoneMuted] = useState(false);
  const [callParticipantProfiles, setCallParticipantProfiles] = useState<Record<string, PublicUserProfile>>({});

  const socketRef = useRef<Socket | null>(null);
  const selectedTextChannelIdRef = useRef<string | null>(null);
  const selectedDirectChatIdRef = useRef<string | null>(null);
  const channelsRef = useRef<Channel[]>([]);
  const joinedTextChannelsRef = useRef<Set<string>>(new Set());
  const restoredSelectedRoomRef = useRef<StoredSelectedRoom | null>(null);
  const directChatsRef = useRef<DirectChat[]>([]);
  const activeVoiceChannelIdRef = useRef<string | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const toastTimeoutsRef = useRef<Map<string, number>>(new Map());
  const notificationAudioRef = useRef<HTMLAudioElement | null>(null);
  const incomingCallAudioRef = useRef<HTMLAudioElement | null>(null);
  const callSoundsEnabledRef = useRef(callSoundsEnabled);
  const notificationsEnabledRef = useRef(notificationsEnabled);
  const mutedRoomsRef = useRef<Set<string>>(new Set());
  const mutedRoomsLoadedForKeyRef = useRef<string | null>(null);
  const skipNextMutedRoomsPersistRef = useRef(false);

  const selectedTextChannel = selectedChannel?.type === "TEXT" ? selectedChannel : null;
  const selectedDirectChat = selectedDirectChatId
    ? directChats.find((chat) => chat.id === selectedDirectChatId) ?? null
    : null;
  const selectedCallRoomId = selectedDirectChat
    ? `dm:${selectedDirectChat.id}`
    : selectedTextChannel
      ? `channel:${selectedTextChannel.id}`
      : null;
  const mutedRoomIdSet = useMemo(() => new Set(mutedRoomIds), [mutedRoomIds]);
  const mutedRoomStorageKey = me ? `brgram-muted-rooms:${me.id}` : null;
  const selectedRoomStorageKey = me ? `brgram-selected-room:${me.id}` : null;
  const selectedRoomNotificationsMuted = selectedCallRoomId ? mutedRoomIdSet.has(selectedCallRoomId) : false;
  const incomingCallNotificationsMuted = incomingCall ? !notificationsEnabled : false;
  const incomingCallSoundMuted = incomingCall ? mutedRoomIdSet.has(incomingCall.roomId) : false;
  const hasActiveCall = voiceConnected && Boolean(activeVoiceChannelId);
  const connectedToCall =
    Boolean(selectedCallRoomId) && voiceConnected && activeVoiceChannelId === selectedCallRoomId;
  const callLocked = hasActiveCall && !connectedToCall;
  const text = UI_TEXT[language];
  const selectedTextChannelOwnerCanInvite =
    selectedTextChannel?.isPrivate === true && selectedTextChannel.ownerId === me?.id;
  const channelInviteCandidates = friends.filter(
    (friend) => !channelInviteMembers.some((member) => member.id === friend.id)
  );
  const knownUsersById = useMemo(() => {
    const next = new Map<
      string,
      {
        username: string;
        avatarUrl: string | null;
      }
    >();

    const upsert = (id: string, username?: string | null, avatarUrl?: string | null) => {
      if (!username && !next.has(id)) return;

      const existing = next.get(id);
      next.set(id, {
        username: username ?? existing?.username ?? "User",
        avatarUrl: avatarUrl ?? existing?.avatarUrl ?? null,
      });
    };

    if (me) {
      upsert(me.id, me.username, me.avatarUrl ?? null);
    }

    for (const user of friends) {
      upsert(user.id, user.username, user.avatarUrl ?? null);
    }

    for (const request of incomingRequests) {
      upsert(request.user.id, request.user.username, request.user.avatarUrl ?? null);
    }

    for (const request of outgoingRequests) {
      upsert(request.user.id, request.user.username, request.user.avatarUrl ?? null);
    }

    for (const chat of directChats) {
      upsert(chat.peer.id, chat.peer.username, chat.peer.avatarUrl ?? null);
    }

    for (const message of messages) {
      upsert(message.author.id, message.author.username, message.author.avatarUrl ?? null);
    }

    for (const message of directMessages) {
      upsert(message.author.id, message.author.username, message.author.avatarUrl ?? null);
    }

    for (const profile of Object.values(callParticipantProfiles)) {
      upsert(profile.id, profile.username, profile.avatarUrl ?? null);
    }

    return next;
  }, [me, friends, incomingRequests, outgoingRequests, directChats, messages, directMessages, callParticipantProfiles]);

  const callParticipants = useMemo(
    () =>
      voiceParticipants.map((participant) => {
        const known = knownUsersById.get(participant.id);
        return {
          id: participant.id,
          username: known?.username ?? participant.username,
          avatarUrl: known?.avatarUrl ?? null,
        };
      }),
    [voiceParticipants, knownUsersById]
  );

  const hasRemoteCallParticipant = useMemo(() => {
    if (!me) return voiceParticipants.length > 0;
    return voiceParticipants.some((participant) => participant.id !== me.id);
  }, [voiceParticipants, me]);

  const activeCallStageParticipants = useMemo(() => {
    if (!connectedToCall) return [];

    const participantsById = new Map<
      string,
      {
        id: string;
        username: string;
        avatarUrl: string | null;
      }
    >();

    const addParticipant = (id: string, username: string, avatarUrl: string | null) => {
      if (!id) return;
      if (participantsById.has(id)) return;
      participantsById.set(id, { id, username, avatarUrl });
    };

    if (me) {
      addParticipant(me.id, me.username, me.avatarUrl ?? null);
    }

    // DM fallback: when remote is connected, ensure peer avatar is always available.
    if (selectedDirectChat && hasRemoteCallParticipant) {
      addParticipant(
        selectedDirectChat.peer.id,
        selectedDirectChat.peer.username,
        selectedDirectChat.peer.avatarUrl ?? null
      );
    }

    for (const participant of callParticipants) {
      addParticipant(participant.id, participant.username, participant.avatarUrl);
    }

    return Array.from(participantsById.values());
  }, [connectedToCall, me, selectedDirectChat, hasRemoteCallParticipant, callParticipants]);

  const activeCallCompactParticipant = useMemo(() => {
    if (!connectedToCall) return null;

    const initiatorId = activeCallInitiatorId;
    if (initiatorId) {
      if (me && initiatorId === me.id) {
        return {
          username: me.username,
          avatarUrl: me.avatarUrl ?? null,
        };
      }

      if (selectedDirectChat && selectedDirectChat.peer.id === initiatorId) {
        return {
          username: selectedDirectChat.peer.username,
          avatarUrl: selectedDirectChat.peer.avatarUrl ?? null,
        };
      }

      const known = knownUsersById.get(initiatorId);
      if (known) {
        return {
          username: known.username,
          avatarUrl: known.avatarUrl ?? null,
        };
      }
    }

    if (activeCallStageParticipants.length > 0) {
      return {
        username: activeCallStageParticipants[0].username,
        avatarUrl: activeCallStageParticipants[0].avatarUrl,
      };
    }

    return null;
  }, [connectedToCall, activeCallInitiatorId, me, selectedDirectChat, knownUsersById, activeCallStageParticipants]);

  const activeCallTitle = useMemo(() => {
    if (selectedDirectChat) return selectedDirectChat.peer.username;
    if (selectedTextChannel) return selectedTextChannel.name;
    return text.activeCallFallback;
  }, [selectedDirectChat, selectedTextChannel, text.activeCallFallback]);

  const activeCallAvatarUrl = useMemo(() => {
    if (selectedDirectChat) return selectedDirectChat.peer.avatarUrl ?? null;
    if (selectedTextChannel) return selectedTextChannel.avatarUrl ?? null;
    return null;
  }, [selectedDirectChat, selectedTextChannel]);

  const applyChannelUpdate = useCallback((channel: Channel) => {
    setChannels((current) => {
      const existingIndex = current.findIndex((item) => item.id === channel.id);
      if (existingIndex === -1) return [...current, channel];

      const next = [...current];
      next[existingIndex] = {
        ...next[existingIndex],
        ...channel,
      };
      return next;
    });

    setSelectedChannel((current) => {
      if (!current || current.id !== channel.id) return current;
      return {
        ...current,
        ...channel,
      };
    });
  }, []);

  const dismissMessageToast = useCallback((toastId: string) => {
    if (typeof window !== "undefined") {
      const timeoutId = toastTimeoutsRef.current.get(toastId);
      if (timeoutId) {
        window.clearTimeout(timeoutId);
        toastTimeoutsRef.current.delete(toastId);
      }
    }

    setMessageToasts((current) => current.filter((toast) => toast.id !== toastId));
  }, []);

  const pushMessageToast = useCallback((title: string, body: string) => {
    if (typeof window === "undefined") return;

    const toastId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setMessageToasts((current) => {
      const next = [...current, { id: toastId, title, body }];
      return next.length > 4 ? next.slice(next.length - 4) : next;
    });

    const timeoutId = window.setTimeout(() => {
      setMessageToasts((current) => current.filter((toast) => toast.id !== toastId));
      toastTimeoutsRef.current.delete(toastId);
    }, 4600);

    toastTimeoutsRef.current.set(toastId, timeoutId);
  }, []);

  const pushSystemNotification = useCallback(
    (
      title: string,
      body: string,
      options?: {
        tag?: string;
        silent?: boolean;
        requireInteraction?: boolean;
      }
    ) => {
      if (typeof window === "undefined") return;
      if (!("Notification" in window)) return;
      if (window.Notification.permission !== "granted") return;

      new window.Notification(title, {
        body,
        tag: options?.tag,
        silent: options?.silent,
        requireInteraction: options?.requireInteraction,
      });
    },
    []
  );

  const playNotificationSound = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!callSoundsEnabledRef.current) return;

    const audio = notificationAudioRef.current ?? new window.Audio(NOTIFICATION_SOUND_PATH);
    if (!notificationAudioRef.current) {
      audio.preload = "auto";
      audio.volume = 1;
      notificationAudioRef.current = audio;
    }

    audio.currentTime = 0;
    void audio.play().catch(() => undefined);
  }, []);

  const stopIncomingCallSound = useCallback(() => {
    const audio = incomingCallAudioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
  }, []);

  const startIncomingCallSound = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!callSoundsEnabledRef.current) return;

    const audio = incomingCallAudioRef.current ?? new window.Audio(INCOMING_CALL_SOUND_PATH);
    if (!incomingCallAudioRef.current) {
      audio.preload = "auto";
      audio.loop = true;
      audio.volume = 1;
      incomingCallAudioRef.current = audio;
    }

    audio.currentTime = 0;
    void audio.play().catch(() => undefined);
  }, []);

  const createPeerConnection = useCallback((targetUserId: string) => {
    const existing = peerConnectionsRef.current.get(targetUserId);
    if (existing) return existing;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    localStreamRef.current?.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current as MediaStream);
    });

    pc.onicecandidate = (event) => {
      const currentVoiceChannelId = activeVoiceChannelIdRef.current;
      if (!event.candidate || !currentVoiceChannelId) return;

      socketRef.current?.emit("voice:signal", {
        channelId: currentVoiceChannelId,
        toUserId: targetUserId,
        data: {
          type: "candidate",
          candidate: event.candidate.toJSON(),
        },
      });
    };

    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (!remoteStream) return;

      remoteStreamsRef.current.set(targetUserId, remoteStream);
      const audioId = `remote-audio-${targetUserId}`;
      let audioEl = document.getElementById(audioId) as HTMLAudioElement | null;
      if (!audioEl) {
        audioEl = document.createElement("audio");
        audioEl.id = audioId;
        audioEl.autoplay = true;
        document.body.appendChild(audioEl);
      }
      audioEl.srcObject = remoteStream;
    };

    peerConnectionsRef.current.set(targetUserId, pc);
    return pc;
  }, []);

  const cleanupVoice = useCallback(() => {
    for (const pc of peerConnectionsRef.current.values()) {
      pc.close();
    }
    peerConnectionsRef.current.clear();

    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;

    for (const userId of remoteStreamsRef.current.keys()) {
      const audioEl = document.getElementById(`remote-audio-${userId}`);
      if (audioEl) {
        audioEl.remove();
      }
    }
    remoteStreamsRef.current.clear();

    setVoiceParticipants([]);
    setVoiceConnected(false);
    setActiveCallInitiatorId(null);
    setMicrophoneMuted(false);
  }, []);

  const leaveVoiceChannel = useCallback(
    (channelId?: string) => {
      const targetChannelId = typeof channelId === "string" ? channelId : activeVoiceChannelIdRef.current;
      if (targetChannelId) {
        socketRef.current?.emit("voice:leave", { channelId: targetChannelId });
      }

      activeVoiceChannelIdRef.current = null;
      setActiveVoiceChannelId(null);
      cleanupVoice();
    },
    [cleanupVoice]
  );

  const toggleMicrophone = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;

    setMicrophoneMuted((current) => {
      const next = !current;
      for (const track of stream.getAudioTracks()) {
        track.enabled = !next;
      }
      return next;
    });
  }, []);

  const toggleCurrentRoomNotifications = useCallback(() => {
    if (!selectedCallRoomId) return;

    setMutedRoomIds((current) => {
      if (current.includes(selectedCallRoomId)) {
        return current.filter((roomId) => roomId !== selectedCallRoomId);
      }
      return [...current, selectedCallRoomId];
    });
  }, [selectedCallRoomId]);

  const fetchChannels = useCallback(async () => {
    if (!token) return;

    const result = await apiFetch<Channel[]>("/channels", {}, token);
    const textChannels = result.filter((channel) => channel.type === "TEXT");
    setChannels(result);

    setSelectedChannel((current) => {
      if (selectedDirectChatIdRef.current) {
        return null;
      }

      const restored = restoredSelectedRoomRef.current;
      if (restored?.kind === "CHANNEL") {
        const restoredChannel = textChannels.find((channel) => channel.id === restored.id);
        if (restoredChannel) {
          restoredSelectedRoomRef.current = null;
          return restoredChannel;
        }
      }

      if (current?.type === "TEXT" && textChannels.find((channel) => channel.id === current.id)) {
        return current;
      }
      return textChannels[0] ?? null;
    });
  }, [token]);

  const fetchFriendsData = useCallback(async () => {
    if (!token) return;

    const result = await apiFetch<FriendsResponse>("/friends", {}, token);
    setFriends(Array.isArray(result.friends) ? result.friends : []);
    const legacyBlockedUsers = (result as FriendsResponse & { blockedUsers?: User[] }).blockedUsers;
    setBlockedUsers((current) => (Array.isArray(legacyBlockedUsers) ? legacyBlockedUsers : current));
    setIncomingRequests(Array.isArray(result.incomingRequests) ? result.incomingRequests : []);
    setOutgoingRequests(Array.isArray(result.outgoingRequests) ? result.outgoingRequests : []);
  }, [token]);

  const fetchDirectChats = useCallback(async () => {
    if (!token) return;

    const result = await apiFetch<DirectChat[]>("/dms", {}, token);
    const sortedChats = sortDirectChats(result);
    setDirectChats(sortedChats);
    setSelectedDirectChatId((current) => {
      const restored = restoredSelectedRoomRef.current;
      const targetChatId = restored?.kind === "DM" ? restored.id : current;
      if (!targetChatId) return null;
      const exists = sortedChats.some((chat) => chat.id === targetChatId);
      if (exists && restored?.kind === "DM") {
        restoredSelectedRoomRef.current = null;
      }
      return exists ? targetChatId : null;
    });
  }, [token]);

  const fetchProfile = useCallback(async () => {
    if (!token) return;

    const profile = await apiFetch<User>("/profile", {}, token);
    setAuth(token, profile);
  }, [token, setAuth]);

  const fetchMessages = useCallback(
    async (channelId: string) => {
      if (!token) return;

      const result = await apiFetch<Message[]>(`/channels/${channelId}/messages`, {}, token);
      setMessages(result);
      socketRef.current?.emit("channel:join", { channelId });
    },
    [token]
  );

  const fetchDirectMessages = useCallback(
    async (chatId: string) => {
      if (!token) return;

      const result = await apiFetch<DirectMessage[]>(`/dms/${chatId}/messages?limit=100`, {}, token);
      setDirectMessages(result);
    },
    [token]
  );

  const uploadChatAttachment = useCallback(
    async (file: File): Promise<MessageAttachment> => {
      if (!token) {
        throw new Error("Unauthorized");
      }

      if (file.size <= 0) {
        throw new Error(text.fileUploadFailed);
      }

      if (file.size > MAX_CHAT_FILE_SIZE_BYTES) {
        throw new Error(text.fileTooLargeError);
      }

      const formData = new FormData();
      formData.append("file", file, file.name);

      const uploaded = await apiFetch<UploadedAttachment>(
        "/uploads",
        {
          method: "POST",
          body: formData,
        },
        token
      );

      return {
        url: uploaded.url,
        name: normalizeAttachmentName(uploaded.name),
        size: Number(uploaded.size),
        mimeType: uploaded.mimeType ?? null,
      };
    },
    [token, text.fileTooLargeError, text.fileUploadFailed]
  );

  const attachFileToChannel = useCallback(
    async (file: File) => {
      try {
        setError(null);
        setChannelAttachmentUploading(true);
        const attachment = await uploadChatAttachment(file);
        setChannelAttachment(attachment);
      } catch (uploadError) {
        setError(uploadError instanceof Error ? uploadError.message : text.fileUploadFailed);
      } finally {
        setChannelAttachmentUploading(false);
      }
    },
    [uploadChatAttachment, text.fileUploadFailed]
  );

  const attachFileToDirect = useCallback(
    async (file: File) => {
      try {
        setError(null);
        setDirectAttachmentUploading(true);
        const attachment = await uploadChatAttachment(file);
        setDirectAttachment(attachment);
      } catch (uploadError) {
        setError(uploadError instanceof Error ? uploadError.message : text.fileUploadFailed);
      } finally {
        setDirectAttachmentUploading(false);
      }
    },
    [uploadChatAttachment, text.fileUploadFailed]
  );

  const sendMessage = useCallback(async () => {
    if (!token || !selectedTextChannel || channelAttachmentUploading) return;

    const content = draft.trim();
    const attachment = channelAttachment;
    if (!content && !attachment) return;

    setDraft("");
    setChannelAttachment(null);

    try {
      const message = await apiFetch<Message>(
        `/channels/${selectedTextChannel.id}/messages`,
        {
          method: "POST",
          body: JSON.stringify({
            content,
            attachment,
          }),
        },
        token
      );

      if (selectedTextChannelIdRef.current === message.channelId) {
        setMessages((current) => {
          if (current.some((item) => item.id === message.id)) return current;
          return [...current, message];
        });
      }
    } catch (sendError) {
      setDraft(content);
      setChannelAttachment(attachment);
      setError(sendError instanceof Error ? sendError.message : "Failed to send message");
    }
  }, [token, selectedTextChannel, channelAttachmentUploading, draft, channelAttachment]);

  const sendDirectMessage = useCallback(async () => {
    if (!token || !selectedDirectChatId || directAttachmentUploading) return;

    const content = directDraft.trim();
    const attachment = directAttachment;
    if (!content && !attachment) return;

    setDirectDraft("");
    setDirectAttachment(null);

    try {
      const message = await apiFetch<DirectMessage>(
        `/dms/${selectedDirectChatId}/messages`,
        {
          method: "POST",
          body: JSON.stringify({ content, attachment }),
        },
        token
      );

      if (selectedDirectChatIdRef.current === message.chatId) {
        setDirectMessages((current) => {
          if (current.some((item) => item.id === message.id)) return current;
          return [...current, message];
        });
      }

      await fetchDirectChats();
    } catch (sendError) {
      setDirectDraft(content);
      setDirectAttachment(attachment);
      setError(sendError instanceof Error ? sendError.message : "Failed to send direct message");
    }
  }, [token, selectedDirectChatId, directAttachmentUploading, directDraft, directAttachment, fetchDirectChats]);

  const createChannel = useCallback(
    async (name: string, description?: string) => {
      if (!token) return;

      await apiFetch(
        "/channels",
        {
          method: "POST",
          body: JSON.stringify({ name, type: "TEXT", description }),
        },
        token
      );

      await fetchChannels();
    },
    [token, fetchChannels]
  );

  const updateChannelAvatar = useCallback(
    async (channelId: string, avatarUrl: string | null) => {
      if (!token) return;

      try {
        setError(null);

        const updatedChannel = await apiFetch<Channel>(
          `/channels/${channelId}`,
          {
            method: "PATCH",
            body: JSON.stringify({ avatarUrl }),
          },
          token
        );

        applyChannelUpdate(updatedChannel);
      } catch (channelError) {
        setError(channelError instanceof Error ? channelError.message : "Failed to update channel avatar");
      }
    },
    [token, applyChannelUpdate]
  );

  const closeChannelInviteModal = useCallback(() => {
    setChannelInviteOpen(false);
    setChannelInviteLoading(false);
    setChannelInviteMembers([]);
    setChannelInviteSendingUserId(null);
  }, []);

  const openChannelInviteModal = useCallback(async () => {
    if (!token || !selectedTextChannel || selectedTextChannel.isPrivate !== true) return;

    try {
      setError(null);
      setChannelInviteOpen(true);
      setChannelInviteLoading(true);
      setChannelInviteMembers([]);

      const members = await apiFetch<User[]>(`/channels/${selectedTextChannel.id}/members`, {}, token);
      setChannelInviteMembers(members);
    } catch (inviteError) {
      setChannelInviteOpen(false);
      setError(inviteError instanceof Error ? inviteError.message : "Failed to load invite list");
    } finally {
      setChannelInviteLoading(false);
    }
  }, [token, selectedTextChannel]);

  const inviteFriendToChannel = useCallback(
    async (friendUserId: string) => {
      if (!token || !selectedTextChannel || selectedTextChannel.isPrivate !== true) return;

      try {
        setError(null);
        setChannelInviteSendingUserId(friendUserId);

        await apiFetch(
          `/channels/${selectedTextChannel.id}/invite`,
          {
            method: "POST",
            body: JSON.stringify({ userId: friendUserId }),
          },
          token
        );

        const members = await apiFetch<User[]>(`/channels/${selectedTextChannel.id}/members`, {}, token);
        setChannelInviteMembers(members);
      } catch (inviteError) {
        setError(inviteError instanceof Error ? inviteError.message : "Failed to invite friend");
      } finally {
        setChannelInviteSendingUserId(null);
      }
    },
    [token, selectedTextChannel]
  );

  const deleteChannel = useCallback(
    async (channel: Channel) => {
      if (!token) return;
      if (!window.confirm(text.deleteConfirm(channel.name))) return;

      try {
        const channelCallRoomId = `channel:${channel.id}`;
        if (activeVoiceChannelIdRef.current === channelCallRoomId) {
          leaveVoiceChannel(channelCallRoomId);
        }

        await apiFetch(
          `/channels/${channel.id}`,
          {
            method: "DELETE",
          },
          token
        );

        if (selectedChannel?.id === channel.id) {
          setSelectedChannel(null);
          setMessages([]);
        }

        await fetchChannels();
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : "Failed to delete channel");
      }
    },
    [token, leaveVoiceChannel, selectedChannel?.id, fetchChannels, text]
  );

  const leaveChannel = useCallback(
    async (channel: Channel) => {
      if (!token || !me) return;
      if (!(channel.isPrivate && channel.ownerId && channel.ownerId !== me.id)) return;
      if (!window.confirm(text.leaveGroupConfirm(channel.name))) return;

      try {
        setError(null);
        const channelCallRoomId = `channel:${channel.id}`;
        if (activeVoiceChannelIdRef.current === channelCallRoomId) {
          leaveVoiceChannel(channelCallRoomId);
        }

        await apiFetch(
          `/channels/${channel.id}/leave`,
          {
            method: "POST",
          },
          token
        );

        if (selectedChannel?.id === channel.id) {
          setSelectedChannel(null);
          setMessages([]);
          setIncomingCall(null);
          closeChannelInviteModal();
        }

        await fetchChannels();
      } catch (leaveError) {
        setError(leaveError instanceof Error ? leaveError.message : "Failed to leave channel");
      }
    },
    [token, me, text, leaveVoiceChannel, selectedChannel?.id, closeChannelInviteModal, fetchChannels]
  );

  const addFriend = useCallback(
    async (username: string) => {
      if (!token) return;

      const normalized = username.trim();
      if (!normalized) return;

      try {
        setError(null);
        await apiFetch(
          "/friends/request",
          {
            method: "POST",
            body: JSON.stringify({ username: normalized }),
          },
          token
        );
        await fetchFriendsData();
      } catch (friendError) {
        setError(friendError instanceof Error ? friendError.message : "Failed to add friend");
      }
    },
    [token, fetchFriendsData]
  );

  const acceptFriendRequest = useCallback(
    async (requestId: string) => {
      if (!token) return;

      try {
        setError(null);
        await apiFetch(
          `/friends/${requestId}/accept`,
          {
            method: "POST",
          },
          token
        );
        await fetchFriendsData();
      } catch (friendError) {
        setError(friendError instanceof Error ? friendError.message : "Failed to accept friend request");
      }
    },
    [token, fetchFriendsData]
  );

  const declineFriendRequest = useCallback(
    async (requestId: string) => {
      if (!token) return;

      try {
        setError(null);
        await apiFetch(
          `/friends/${requestId}/decline`,
          {
            method: "POST",
          },
          token
        );
        await fetchFriendsData();
      } catch (friendError) {
        setError(friendError instanceof Error ? friendError.message : "Failed to decline friend request");
      }
    },
    [token, fetchFriendsData]
  );

  const removeFriend = useCallback(
    async (friendUserId: string) => {
      if (!token) return;

      try {
        setError(null);
        await apiFetch(
          `/friends/${friendUserId}`,
          {
            method: "DELETE",
          },
          token
        );

        if (selectedDirectChat?.peer.id === friendUserId) {
          const directRoomId = `dm:${selectedDirectChat.id}`;
          if (activeVoiceChannelIdRef.current === directRoomId) {
            leaveVoiceChannel(directRoomId);
          }
          setSelectedDirectChatId(null);
          setDirectMessages([]);
          setDirectDraft("");
          setDirectAttachment(null);
          setIncomingCall(null);
        }

        await Promise.all([fetchFriendsData(), fetchDirectChats()]);
      } catch (friendError) {
        setError(friendError instanceof Error ? friendError.message : "Failed to remove friend");
      }
    },
    [token, selectedDirectChat, leaveVoiceChannel, fetchFriendsData, fetchDirectChats]
  );

  const unblockUserAndRestoreFriend = useCallback(
    async (userId: string) => {
      if (!token) return;

      try {
        setError(null);
        await apiFetch(
          `/users/${userId}/block`,
          {
            method: "DELETE",
          },
          token
        );

        await Promise.all([fetchFriendsData(), fetchDirectChats()]);
      } catch (blockError) {
        setError(blockError instanceof Error ? blockError.message : "Failed to unblock user");
      }
    },
    [token, fetchFriendsData, fetchDirectChats]
  );

  const saveProfile = useCallback(async () => {
    if (!token || !me) return;

    try {
      setError(null);
      setProfileSaving(true);

      const normalizedUsername = profileUsername.trim();
      const payload = {
        username: normalizedUsername,
        avatarUrl: profileAvatarUrl.trim() ? profileAvatarUrl.trim() : null,
        bio: profileBio.trim() ? profileBio.trim() : null,
      };

      const response = await apiFetch<{ token: string; user: User }>(
        "/profile",
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        },
        token
      );

      setAuth(response.token, response.user);
    } catch (profileError) {
      setError(profileError instanceof Error ? profileError.message : "Failed to update profile");
    } finally {
      setProfileSaving(false);
    }
  }, [token, me, profileUsername, profileAvatarUrl, profileBio, setAuth]);

  const closeUserProfile = useCallback(() => {
    setUserProfileOpen(false);
    setSelectedUserProfile(null);
    setUserProfileLoading(false);
    setUserProfileActionSaving(false);
  }, []);

  const openUserProfile = useCallback(
    async (userId: string) => {
      if (!token) return;

      try {
        setError(null);
        setUserProfileOpen(true);
        setUserProfileLoading(true);
        setSelectedUserProfile(null);

        const profile = await apiFetch<PublicUserProfile>(`/users/${userId}/profile`, {}, token);
        setSelectedUserProfile(profile);
      } catch (profileError) {
        setUserProfileOpen(false);
        setError(profileError instanceof Error ? profileError.message : "Failed to load user profile");
      } finally {
        setUserProfileLoading(false);
      }
    },
    [token]
  );

  const toggleUserBlock = useCallback(async () => {
    if (!token || !selectedUserProfile) return;

    const targetProfile = selectedUserProfile;
    const targetUserId = selectedUserProfile.id;
    const willBlock = !selectedUserProfile.isBlocked;

    try {
      setError(null);
      setUserProfileActionSaving(true);

      await apiFetch(
        `/users/${targetUserId}/block`,
        {
          method: willBlock ? "POST" : "DELETE",
        },
        token
      );

      if (willBlock) {
        setBlockedUsers((current) => {
          if (current.some((blockedUser) => blockedUser.id === targetUserId)) return current;
          return [
            ...current,
            {
              id: targetProfile.id,
              email: "",
              username: targetProfile.username,
              avatarUrl: targetProfile.avatarUrl,
              bio: targetProfile.bio,
            },
          ];
        });
        setFriends((current) => current.filter((friend) => friend.id !== targetUserId));
      } else {
        setBlockedUsers((current) => current.filter((blockedUser) => blockedUser.id !== targetUserId));
      }

      const refreshedProfile = await apiFetch<PublicUserProfile>(`/users/${targetUserId}/profile`, {}, token);
      setSelectedUserProfile(refreshedProfile);

      if (willBlock && selectedDirectChat?.peer.id === targetUserId) {
        const directRoomId = `dm:${selectedDirectChat.id}`;
        if (activeVoiceChannelIdRef.current === directRoomId) {
          leaveVoiceChannel(directRoomId);
        }
        setSelectedDirectChatId(null);
        setDirectMessages([]);
        setDirectDraft("");
        setDirectAttachment(null);
        setIncomingCall(null);
      }

      await Promise.all([fetchFriendsData(), fetchDirectChats()]);
    } catch (blockError) {
      setError(blockError instanceof Error ? blockError.message : "Failed to change block status");
    } finally {
      setUserProfileActionSaving(false);
    }
  }, [token, selectedUserProfile, selectedDirectChat, leaveVoiceChannel, fetchFriendsData, fetchDirectChats]);

  const openDirectChatWithUser = useCallback(
    async (user: User) => {
      if (!token) return;

      try {
        setError(null);

        const chat = await apiFetch<DirectChat>(
          "/dms/open",
          {
            method: "POST",
            body: JSON.stringify({ peerUserId: user.id }),
          },
          token
        );

        setSelectedChannel(null);
        setMessages([]);
        setChannelAttachment(null);
        setSelectedDirectChatId(chat.id);
        setDirectDraft("");
        setDirectAttachment(null);
        setIncomingCall(null);

        await Promise.all([fetchDirectChats(), fetchDirectMessages(chat.id)]);
      } catch (dmError) {
        setError(dmError instanceof Error ? dmError.message : "Failed to open direct chat");
      }
    },
    [token, fetchDirectChats, fetchDirectMessages]
  );

  const joinVoiceChannel = useCallback(
    async (roomId?: string, initiatorId?: string) => {
      const targetRoomId = roomId ?? selectedCallRoomId;
      if (!targetRoomId || !socketRef.current || !me) return;

      try {
        const currentVoiceChannelId = activeVoiceChannelIdRef.current;
        if (currentVoiceChannelId && currentVoiceChannelId !== targetRoomId) {
          setError(text.alreadyInCall);
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
        for (const track of stream.getAudioTracks()) {
          track.enabled = true;
        }
        localStreamRef.current = stream;
        setMicrophoneMuted(false);

        activeVoiceChannelIdRef.current = targetRoomId;
        setActiveVoiceChannelId(targetRoomId);
        setVoiceConnected(true);
        setActiveCallInitiatorId(initiatorId ?? me.id);
        setVoiceParticipants((current) => {
          if (current.some((participant) => participant.id === me.id)) return current;
          return [
            ...current,
            {
              id: me.id,
              username: me.username,
            },
          ];
        });

        socketRef.current.emit("voice:join", {
          channelId: targetRoomId,
        });
        setIncomingCall(null);
      } catch {
        setError("Cannot access microphone. Check browser permissions.");
      }
    },
    [selectedCallRoomId, me, text]
  );

  const answerIncomingCall = useCallback(async () => {
    const call = incomingCall;
    if (!call) return;

    if (activeVoiceChannelIdRef.current && activeVoiceChannelIdRef.current !== call.roomId) {
      setError(text.alreadyInCall);
      return;
    }

    if (call.kind === "CHANNEL" && call.channelId) {
      let targetChannel = channels.find(
        (channel) => channel.id === call.channelId && channel.type === "TEXT"
      );
      if (!targetChannel && token) {
        try {
          const loadedChannels = await apiFetch<Channel[]>("/channels", {}, token);
          setChannels(loadedChannels);
          targetChannel = loadedChannels.find(
            (channel) => channel.id === call.channelId && channel.type === "TEXT"
          );
        } catch (fetchError) {
          setError(fetchError instanceof Error ? fetchError.message : "Failed to load channels");
        }
      }
      if (targetChannel) {
        setSelectedDirectChatId(null);
        setDirectMessages([]);
        setDirectDraft("");
        setDirectAttachment(null);
        setSelectedChannel(targetChannel);
      }
    }

    if (call.kind === "DM" && call.directChatId) {
      if (!directChats.some((chat) => chat.id === call.directChatId)) {
        try {
          await fetchDirectChats();
        } catch (fetchError) {
          setError(fetchError instanceof Error ? fetchError.message : "Failed to load direct chats");
        }
      }

      setSelectedChannel(null);
      setMessages([]);
      setChannelAttachment(null);
      setSelectedDirectChatId(call.directChatId);
      setDirectDraft("");
      setDirectAttachment(null);
      fetchDirectMessages(call.directChatId).catch((fetchError) => {
        setError(fetchError instanceof Error ? fetchError.message : "Failed to load direct messages");
      });
    }

    setIncomingCall(null);
    await joinVoiceChannel(call.roomId, call.fromUserId);
  }, [
    incomingCall,
    channels,
    directChats,
    fetchDirectChats,
    fetchDirectMessages,
    joinVoiceChannel,
    token,
    text,
  ]);

  const declineIncomingCall = useCallback(() => {
    setIncomingCall(null);
  }, []);

  useEffect(() => {
    selectedTextChannelIdRef.current = selectedTextChannel?.id ?? null;
  }, [selectedTextChannel?.id]);

  useEffect(() => {
    selectedDirectChatIdRef.current = selectedDirectChatId;
  }, [selectedDirectChatId]);

  useEffect(() => {
    channelsRef.current = channels;
  }, [channels]);

  useEffect(() => {
    directChatsRef.current = directChats;
  }, [directChats]);

  useEffect(() => {
    activeVoiceChannelIdRef.current = activeVoiceChannelId;
  }, [activeVoiceChannelId]);

  useEffect(() => {
    callSoundsEnabledRef.current = callSoundsEnabled;
  }, [callSoundsEnabled]);

  useEffect(() => {
    notificationsEnabledRef.current = notificationsEnabled;
  }, [notificationsEnabled]);

  useEffect(() => {
    mutedRoomsRef.current = new Set(mutedRoomIds);
  }, [mutedRoomIds]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const nextTextChannelIds = new Set(
      channels.filter((channel) => channel.type === "TEXT").map((channel) => channel.id)
    );
    const prevTextChannelIds = joinedTextChannelsRef.current;

    for (const channelId of nextTextChannelIds) {
      if (!prevTextChannelIds.has(channelId)) {
        socket.emit("channel:join", { channelId });
      }
    }

    for (const channelId of prevTextChannelIds) {
      if (!nextTextChannelIds.has(channelId)) {
        socket.emit("channel:leave", { channelId });
      }
    }

    joinedTextChannelsRef.current = nextTextChannelIds;
  }, [channels]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!mutedRoomStorageKey) {
      mutedRoomsLoadedForKeyRef.current = null;
      skipNextMutedRoomsPersistRef.current = true;
      setMutedRoomIds([]);
      return;
    }

    let nextMutedRoomIds: string[] = [];
    const saved = window.localStorage.getItem(mutedRoomStorageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          nextMutedRoomIds = parsed.filter((value): value is string => typeof value === "string");
        }
      } catch {
        nextMutedRoomIds = [];
      }
    }

    mutedRoomsLoadedForKeyRef.current = mutedRoomStorageKey;
    skipNextMutedRoomsPersistRef.current = true;
    setMutedRoomIds(nextMutedRoomIds);
  }, [mutedRoomStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!mutedRoomStorageKey) return;
    if (mutedRoomsLoadedForKeyRef.current !== mutedRoomStorageKey) return;
    if (skipNextMutedRoomsPersistRef.current) {
      skipNextMutedRoomsPersistRef.current = false;
      return;
    }

    window.localStorage.setItem(mutedRoomStorageKey, JSON.stringify(mutedRoomIds));
  }, [mutedRoomStorageKey, mutedRoomIds]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!selectedRoomStorageKey) {
      restoredSelectedRoomRef.current = null;
      return;
    }

    const saved = window.localStorage.getItem(selectedRoomStorageKey);
    if (!saved) {
      restoredSelectedRoomRef.current = null;
      return;
    }

    try {
      const parsed = JSON.parse(saved) as Partial<StoredSelectedRoom>;
      if (
        (parsed.kind === "DM" || parsed.kind === "CHANNEL") &&
        typeof parsed.id === "string" &&
        parsed.id.length > 0
      ) {
        restoredSelectedRoomRef.current = {
          kind: parsed.kind,
          id: parsed.id,
        };

        if (parsed.kind === "DM") {
          setSelectedDirectChatId(parsed.id);
          setSelectedChannel(null);
          setMessages([]);
        } else {
          setSelectedDirectChatId(null);
          setDirectMessages([]);
        }
        return;
      }
    } catch {
      // ignore invalid persisted data
    }

    restoredSelectedRoomRef.current = null;
  }, [selectedRoomStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!selectedRoomStorageKey) return;

    if (selectedDirectChatId) {
      window.localStorage.setItem(
        selectedRoomStorageKey,
        JSON.stringify({
          kind: "DM",
          id: selectedDirectChatId,
        } satisfies StoredSelectedRoom)
      );
      return;
    }

    if (selectedTextChannel?.id) {
      window.localStorage.setItem(
        selectedRoomStorageKey,
        JSON.stringify({
          kind: "CHANNEL",
          id: selectedTextChannel.id,
        } satisfies StoredSelectedRoom)
      );
    }
  }, [selectedRoomStorageKey, selectedDirectChatId, selectedTextChannel?.id]);

  useEffect(() => {
    if (!settingsOpen || !me) return;
    setProfileUsername(me.username);
    setProfileAvatarUrl(me.avatarUrl ?? "");
    setProfileBio(me.bio ?? "");
  }, [settingsOpen, me]);

  useEffect(() => {
    if (selectedTextChannel) return;
    if (!channelInviteOpen) return;
    closeChannelInviteModal();
  }, [selectedTextChannel, channelInviteOpen, closeChannelInviteModal]);

  useEffect(() => {
    if (!token || !me) {
      disconnectSocket();
      socketRef.current = null;
      joinedTextChannelsRef.current = new Set();
      return;
    }

    const socket = connectSocket(token);
    socketRef.current = socket;
    const joinKnownTextChannels = () => {
      const textChannelIds = joinedTextChannelsRef.current.size
        ? Array.from(joinedTextChannelsRef.current)
        : channelsRef.current.filter((channel) => channel.type === "TEXT").map((channel) => channel.id);
      for (const channelId of textChannelIds) {
        socket.emit("channel:join", { channelId });
      }
    };

    socket.on("connect_error", () => {
      setError("Realtime connection failed");
    });

    socket.on("connect", joinKnownTextChannels);

    socket.on("channel:created", () => {
      fetchChannels().catch((fetchError) => {
        setError(fetchError instanceof Error ? fetchError.message : "Failed to update channels");
      });
    });

    socket.on("channel:updated", () => {
      fetchChannels().catch((fetchError) => {
        setError(fetchError instanceof Error ? fetchError.message : "Failed to update channels");
      });
    });

    socket.on("channel:deleted", ({ id }: { id: string }) => {
      setChannels((current) => current.filter((item) => item.id !== id));
      setSelectedChannel((current) => (current?.id === id ? null : current));

      if (selectedTextChannelIdRef.current === id) {
        selectedTextChannelIdRef.current = null;
        setMessages([]);
      }

      if (activeVoiceChannelIdRef.current === `channel:${id}`) {
        activeVoiceChannelIdRef.current = null;
        setActiveVoiceChannelId(null);
        cleanupVoice();
      }
    });

    socket.on("message:new", (message: Message) => {
      const selectedChannelId = selectedTextChannelIdRef.current;
      if (selectedChannelId === message.channelId) {
        setMessages((current) => {
          if (current.some((item) => item.id === message.id)) return current;
          return [...current, message];
        });
      }

      const roomId = `channel:${message.channelId}`;
      const isMutedRoom = mutedRoomsRef.current.has(roomId);
      const shouldNotify = message.authorId !== me.id && notificationsEnabledRef.current && !isMutedRoom;

      if (shouldNotify) {
        const channelName = channelsRef.current.find((channel) => channel.id === message.channelId)?.name ?? "brgram";
        const messagePreview = `${message.author.username}: ${getMessagePreview(
          message.content,
          message.attachment,
          text.fileLabel
        )}`;
        pushMessageToast(channelName, messagePreview);
        playNotificationSound();
        pushSystemNotification(channelName, messagePreview, {
          tag: `message:${message.id}`,
          silent: !callSoundsEnabledRef.current,
        });
      }
    });

    socket.on("friends:updated", () => {
      Promise.all([fetchFriendsData(), fetchDirectChats()]).catch((fetchError) => {
        setError(fetchError instanceof Error ? fetchError.message : "Failed to update friends");
      });
    });

    socket.on(
      "user:block-updated",
      ({ targetUserId, action }: { targetUserId: string; action: "BLOCKED" | "UNBLOCKED" }) => {
        if (action === "BLOCKED") {
          const currentDirectChats = directChatsRef.current;
          const selectedChatId = selectedDirectChatIdRef.current;
          const selectedChat = selectedChatId
            ? currentDirectChats.find((chat) => chat.id === selectedChatId) ?? null
            : null;
          const activeVoiceRoom = activeVoiceChannelIdRef.current;

          if (selectedChat?.peer.id === targetUserId) {
            setSelectedDirectChatId(null);
            setDirectMessages([]);
            setDirectDraft("");
            setDirectAttachment(null);
            setIncomingCall(null);
          }

          if (activeVoiceRoom?.startsWith("dm:")) {
            const voiceChatId = activeVoiceRoom.slice(3);
            const voiceChat = currentDirectChats.find((chat) => chat.id === voiceChatId) ?? null;
            if (voiceChat?.peer.id === targetUserId) {
              leaveVoiceChannel(activeVoiceRoom);
              setIncomingCall(null);
            }
          }
        }

        Promise.all([fetchFriendsData(), fetchDirectChats()]).catch((fetchError) => {
          setError(fetchError instanceof Error ? fetchError.message : "Failed to update block state");
        });
      }
    );

    socket.on("dm:new", (message: DirectMessage) => {
      fetchDirectChats().catch((fetchError) => {
        setError(fetchError instanceof Error ? fetchError.message : "Failed to update direct chats");
      });

      const roomId = `dm:${message.chatId}`;
      const isMutedRoom = mutedRoomsRef.current.has(roomId);
      const selectedChatId = selectedDirectChatIdRef.current;
      const shouldNotify = message.authorId !== me.id && notificationsEnabledRef.current && !isMutedRoom;

      if (shouldNotify) {
        const messagePreview = getMessagePreview(message.content, message.attachment, text.fileLabel);
        pushMessageToast(message.author.username, messagePreview);
        playNotificationSound();
        pushSystemNotification(message.author.username, messagePreview, {
          tag: `message:${message.id}`,
          silent: !callSoundsEnabledRef.current,
        });
      }

      if (selectedChatId !== message.chatId) return;
      setDirectMessages((current) => {
        if (current.some((item) => item.id === message.id)) return current;
        return [...current, message];
      });
    });

    socket.on("call:incoming", (payload: IncomingCallPayload) => {
      if (payload.fromUserId === me.id) return;
      if (activeVoiceChannelIdRef.current === payload.roomId) return;
      setIncomingCall(payload);
    });

    socket.on(
      "call:cancelled",
      ({ roomId, fromUserId, kind }: { roomId: string; fromUserId: string; kind?: "DM" | "CHANNEL" }) => {
        setIncomingCall((current) => {
          if (!current) return current;
          if (current.roomId !== roomId) return current;
          if ((kind ?? current.kind) === "CHANNEL") return null;
          if (current.fromUserId !== fromUserId) return current;
          return null;
        });
      }
    );

    socket.on(
      "voice:participants",
      ({ channelId, participants }: { channelId: string; participants: VoiceParticipant[] }) => {
        if (channelId !== activeVoiceChannelIdRef.current) return;
        setVoiceParticipants(participants);
      }
    );

    socket.on("voice:join-rejected", ({ channelId, reason }: { channelId: string; reason: string }) => {
      if (channelId !== activeVoiceChannelIdRef.current) return;

      activeVoiceChannelIdRef.current = null;
      setActiveVoiceChannelId(null);
      cleanupVoice();
      setIncomingCall(null);
      setError(reason === "BLOCKED" ? "Call unavailable: one of users is blocked" : "Cannot join voice call");
    });

    socket.on(
      "voice:user-joined",
      async ({ channelId, user }: { channelId: string; user: VoiceParticipant }) => {
        const currentVoiceChannelId = activeVoiceChannelIdRef.current;
        if (!currentVoiceChannelId || channelId !== currentVoiceChannelId || user.id === me.id) return;

        setVoiceParticipants((current) => {
          if (current.some((participant) => participant.id === user.id)) return current;
          return [...current, user];
        });

        const pc = createPeerConnection(user.id);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit("voice:signal", {
          channelId,
          toUserId: user.id,
          data: {
            type: "offer",
            sdp: offer,
          } satisfies VoiceSignalPayload,
        });
      }
    );

    socket.on(
      "voice:user-left",
      ({ channelId, userId }: { channelId: string; userId: string }) => {
        if (channelId !== activeVoiceChannelIdRef.current) return;

        setVoiceParticipants((current) => current.filter((participant) => participant.id !== userId));

        const pc = peerConnectionsRef.current.get(userId);
        pc?.close();
        peerConnectionsRef.current.delete(userId);

        const audioEl = document.getElementById(`remote-audio-${userId}`);
        if (audioEl) {
          audioEl.remove();
        }

        if (channelId.startsWith("dm:")) {
          leaveVoiceChannel(channelId);
        }
      }
    );

    socket.on(
      "voice:signal",
      async ({
        channelId,
        fromUserId,
        data,
      }: {
        channelId: string;
        fromUserId: string;
        data: VoiceSignalPayload;
      }) => {
        const currentVoiceChannelId = activeVoiceChannelIdRef.current;
        if (!currentVoiceChannelId || channelId !== currentVoiceChannelId || fromUserId === me.id) return;

        const pc = createPeerConnection(fromUserId);

        if (data.type === "offer" && data.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          socket.emit("voice:signal", {
            channelId,
            toUserId: fromUserId,
            data: {
              type: "answer",
              sdp: answer,
            } satisfies VoiceSignalPayload,
          });
        }

        if (data.type === "answer" && data.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        }

        if (data.type === "candidate" && data.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      }
    );

    return () => {
      socket.disconnect();
    };
  }, [
    token,
    me,
    createPeerConnection,
    cleanupVoice,
    fetchFriendsData,
    fetchDirectChats,
    fetchChannels,
    applyChannelUpdate,
    leaveVoiceChannel,
    playNotificationSound,
    pushSystemNotification,
    pushMessageToast,
    text.fileLabel,
  ]);

  useEffect(() => {
    if (!token) return;

    Promise.all([fetchProfile(), fetchChannels(), fetchFriendsData(), fetchDirectChats()]).catch((fetchError) => {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load app data");
    });
  }, [token, fetchProfile, fetchChannels, fetchFriendsData, fetchDirectChats]);

  useEffect(() => {
    if (!incomingCall) return;
    if (!notificationsEnabled) return;
    if (incomingCallNotificationsMuted) return;
    pushSystemNotification(text.incomingCallTitle, text.incomingCallMessage(incomingCall.fromUsername), {
      tag: `incoming-call:${incomingCall.roomId}`,
      requireInteraction: true,
      silent: !callSoundsEnabled || incomingCallSoundMuted,
    });
  }, [
    incomingCall,
    notificationsEnabled,
    incomingCallNotificationsMuted,
    callSoundsEnabled,
    incomingCallSoundMuted,
    text,
    pushSystemNotification,
  ]);

  useEffect(() => {
    const shouldPlayIncomingCallSound =
      Boolean(incomingCall) &&
      notificationsEnabled &&
      !incomingCallNotificationsMuted &&
      !incomingCallSoundMuted &&
      callSoundsEnabled;

    if (!shouldPlayIncomingCallSound) {
      stopIncomingCallSound();
      return;
    }

    startIncomingCallSound();
    return () => {
      stopIncomingCallSound();
    };
  }, [
    incomingCall,
    notificationsEnabled,
    incomingCallNotificationsMuted,
    incomingCallSoundMuted,
    callSoundsEnabled,
    startIncomingCallSound,
    stopIncomingCallSound,
  ]);

  useEffect(() => {
    return () => {
      if (typeof window === "undefined") return;
      for (const timeoutId of toastTimeoutsRef.current.values()) {
        window.clearTimeout(timeoutId);
      }
      toastTimeoutsRef.current.clear();
      stopIncomingCallSound();
    };
  }, [stopIncomingCallSound]);

  const toggleNotifications = useCallback(() => {
    setNotificationsEnabled((current) => {
      const next = !current;
      if (
        next &&
        typeof window !== "undefined" &&
        "Notification" in window &&
        window.Notification.permission === "default"
      ) {
        void window.Notification.requestPermission().catch(() => undefined);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!token || !me || voiceParticipants.length === 0) return;

    const missingUserIds = voiceParticipants
      .map((participant) => participant.id)
      .filter((userId) => userId !== me.id && !callParticipantProfiles[userId]);

    if (missingUserIds.length === 0) return;

    let cancelled = false;

    Promise.all(
      missingUserIds.map(async (userId) => {
        try {
          return await apiFetch<PublicUserProfile>(`/users/${userId}/profile`, {}, token);
        } catch {
          return null;
        }
      })
    )
      .then((profiles) => {
        if (cancelled) return;

        setCallParticipantProfiles((current) => {
          let changed = false;
          const next = { ...current };

          for (const profile of profiles) {
            if (!profile) continue;
            if (!next[profile.id]) {
              next[profile.id] = profile;
              changed = true;
            }
          }

          return changed ? next : current;
        });
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [token, me, voiceParticipants, callParticipantProfiles]);

  useEffect(() => {
    if (!selectedTextChannel) {
      setMessages([]);
      setChannelAttachment(null);
      setChannelAttachmentUploading(false);
      return;
    }

    setChannelAttachment(null);
    setChannelAttachmentUploading(false);
    fetchMessages(selectedTextChannel.id).catch((fetchError) => {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load messages");
    });
  }, [selectedTextChannel, fetchMessages]);

  useEffect(() => {
    if (!selectedDirectChatId) {
      setDirectMessages([]);
      setDirectAttachment(null);
      setDirectAttachmentUploading(false);
      return;
    }

    setDirectAttachment(null);
    setDirectAttachmentUploading(false);
    fetchDirectMessages(selectedDirectChatId).catch((fetchError) => {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load direct messages");
    });
  }, [selectedDirectChatId, fetchDirectMessages]);

  useEffect(() => {
    return () => {
      cleanupVoice();
      disconnectSocket();
    };
  }, [cleanupVoice]);

  useEffect(() => {
    if (typeof document === "undefined" || typeof window === "undefined") return;

    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.setAttribute("data-font-size", fontSize);
    document.documentElement.setAttribute("lang", language);
    window.localStorage.setItem("brgram-theme", theme);
    window.localStorage.setItem("brgram-language", language);
    window.localStorage.setItem("brgram-font-size", fontSize);
    window.localStorage.setItem("brgram-notifications-enabled", notificationsEnabled ? "true" : "false");
    window.localStorage.setItem("brgram-call-sounds-enabled", callSoundsEnabled ? "true" : "false");
  }, [theme, language, fontSize, notificationsEnabled, callSoundsEnabled]);

  if (!token || !me) {
    return <AuthForm onAuth={(newToken, user) => setAuth(newToken, user)} language={language} />;
  }

  return (
    <main className="app-shell">
      {incomingCall ? (
        <div className="incoming-call-banner" role="status" aria-live="polite">
          <h4>{text.incomingCallTitle}</h4>
          <p>{text.incomingCallMessage(incomingCall.fromUsername)}</p>
          <div className="incoming-call-actions">
            <button onClick={() => answerIncomingCall().catch(() => undefined)}>{text.answerCall}</button>
            <button className="ghost-button" onClick={declineIncomingCall}>
              {text.declineCall}
            </button>
          </div>
        </div>
      ) : null}

      {messageToasts.length > 0 ? (
        <div className="message-toast-stack" role="status" aria-live="polite">
          {messageToasts.map((toast) => (
            <button
              key={toast.id}
              type="button"
              className="message-toast"
              onClick={() => dismissMessageToast(toast.id)}
              title={toast.body}
            >
              <strong>{toast.title}</strong>
              <p>{toast.body}</p>
            </button>
          ))}
        </div>
      ) : null}

      <ChannelSidebar
        channels={channels}
        friends={friends}
        blockedUsers={blockedUsers}
        incomingRequests={incomingRequests}
        outgoingRequests={outgoingRequests}
        directChats={directChats}
        selectedChannelId={selectedDirectChatId ? null : (selectedChannel?.id ?? null)}
        selectedDirectChatId={selectedDirectChatId}
        meId={me.id}
        meUsername={me.username}
        meAvatarUrl={me.avatarUrl}
        error={error}
        textChannelsLabel={text.textChannels}
        settingsLabel={text.settings}
        logoutLabel={text.logout}
        friendsLabel={text.friends}
        requestsLabel={text.requests}
        blockedLabel={text.blockedUsers}
        addFriendPrompt={text.addFriendPrompt}
        addFriendLabel={text.addFriend}
        removeFriendLabel={text.removeFriend}
        openProfileLabel={text.openProfile}
        unblockLabel={text.unblockUser}
        acceptLabel={text.accept}
        declineLabel={text.decline}
        outgoingLabel={text.outgoing}
        createTextPrompt={text.createTextPrompt}
        descriptionPrompt={text.descriptionPrompt}
        leaveGroupLabel={text.leaveGroup}
        deleteChannelLabel={text.deleteChannel}
        onSelectChannel={(channel) => {
          closeChannelInviteModal();
          setIncomingCall(null);
          setSelectedDirectChatId(null);
          setDirectMessages([]);
          setDirectDraft("");
          setDirectAttachment(null);
          setSelectedChannel(channel);
        }}
        onCreateChannel={createChannel}
        onDeleteChannel={deleteChannel}
        onLeaveChannel={(channel) => {
          leaveChannel(channel).catch(() => undefined);
        }}
        onOpenUserProfile={(userId) => {
          openUserProfile(userId).catch(() => undefined);
        }}
        onRemoveFriend={(userId) => {
          removeFriend(userId).catch(() => undefined);
        }}
        onUnblockUser={(userId) => {
          unblockUserAndRestoreFriend(userId).catch(() => undefined);
        }}
        onSelectDirectChat={(chat) => {
          closeChannelInviteModal();
          setIncomingCall(null);
          setSelectedChannel(null);
          setMessages([]);
          setChannelAttachment(null);
          setSelectedDirectChatId(chat.id);
          setDirectDraft("");
          setDirectAttachment(null);
        }}
        onAddFriend={addFriend}
        onAcceptFriendRequest={acceptFriendRequest}
        onDeclineFriendRequest={declineFriendRequest}
        onOpenSettings={() => setSettingsOpen(true)}
        onLogout={() => {
          leaveVoiceChannel();
          closeUserProfile();
          closeChannelInviteModal();
          clearAuth();
          setChannels([]);
          setSelectedChannel(null);
          setMessages([]);
          setDraft("");
          setChannelAttachment(null);
          setChannelAttachmentUploading(false);
          setFriends([]);
          setBlockedUsers([]);
          setIncomingRequests([]);
          setOutgoingRequests([]);
          setDirectChats([]);
          setSelectedDirectChatId(null);
          setDirectMessages([]);
          setDirectDraft("");
          setDirectAttachment(null);
          setDirectAttachmentUploading(false);
          setMicrophoneMuted(false);
          setCallParticipantProfiles({});
          setProfileUsername("");
          setProfileAvatarUrl("");
          setProfileBio("");
          setIncomingCall(null);
          setError(null);
        }}
      />

      <section className="chat-stage">
        {selectedCallRoomId ? (
          <ActiveCallBar
            avatarUrl={activeCallAvatarUrl}
            title={activeCallTitle}
            participants={activeCallStageParticipants}
            compactAvatarUrl={activeCallCompactParticipant?.avatarUrl ?? null}
            compactAvatarName={activeCallCompactParticipant?.username ?? null}
            participantsLabel={text.participants}
            connected={connectedToCall}
            callLocked={callLocked}
            callLockedLabel={text.alreadyInCall}
            muted={microphoneMuted}
            notificationsMuted={selectedRoomNotificationsMuted}
            joinLabel={text.joinVoice}
            leaveLabel={text.leaveVoice}
            muteLabel={text.muteMicrophone}
            unmuteLabel={text.unmuteMicrophone}
            muteNotificationsLabel={text.muteChatNotifications}
            unmuteNotificationsLabel={text.unmuteChatNotifications}
            onJoin={() => {
              joinVoiceChannel(selectedCallRoomId).catch(() => undefined);
            }}
            onLeave={() => {
              leaveVoiceChannel(selectedCallRoomId);
            }}
            onToggleMute={toggleMicrophone}
            onToggleNotifications={toggleCurrentRoomNotifications}
          />
        ) : null}

        {selectedDirectChat ? (
          <DirectChatView
            chat={selectedDirectChat}
            meId={me.id}
            messages={directMessages}
            draft={directDraft}
            youLabel={text.you}
            sendLabel={text.send}
            messagePlaceholderPrefix={text.messagePlaceholder}
            attachFileLabel={text.attachFile}
            removeFileLabel={text.removeFile}
            uploadingFileLabel={text.uploadingFile}
            pendingAttachmentName={directAttachment?.name ?? null}
            uploadingAttachment={directAttachmentUploading}
            onDraftChange={setDirectDraft}
            onSendMessage={sendDirectMessage}
            onAttachFile={attachFileToDirect}
            onRemoveAttachment={() => {
              setDirectAttachment(null);
            }}
          />
        ) : !selectedChannel ? (
          <section className="main-panel empty">{text.emptyState}</section>
        ) : selectedChannel.type === "TEXT" ? (
          <ChatView
            channel={selectedChannel}
            meId={me.id}
            messages={messages}
            draft={draft}
            hideHeader={Boolean(selectedCallRoomId)}
            youLabel={text.you}
            sendLabel={text.send}
            textChannelFallback={text.chatFallback}
            messagePlaceholderPrefix={text.messagePlaceholder}
            changeAvatarLabel={text.channelAvatarChange}
            removeAvatarLabel={text.channelAvatarRemove}
            inviteLabel={text.channelInvite}
            attachFileLabel={text.attachFile}
            removeFileLabel={text.removeFile}
            uploadingFileLabel={text.uploadingFile}
            showInviteButton={selectedTextChannelOwnerCanInvite}
            pendingAttachmentName={channelAttachment?.name ?? null}
            uploadingAttachment={channelAttachmentUploading}
            onDraftChange={setDraft}
            onSendMessage={sendMessage}
            onAttachFile={attachFileToChannel}
            onRemoveAttachment={() => {
              setChannelAttachment(null);
            }}
            onSetAvatar={(avatarUrl) => {
              updateChannelAvatar(selectedChannel.id, avatarUrl).catch(() => undefined);
            }}
            onOpenInvite={() => {
              openChannelInviteModal().catch(() => undefined);
            }}
          />
        ) : (
          <section className="main-panel empty">{text.emptyState}</section>
        )}
      </section>

      <ChannelInviteModal
        open={channelInviteOpen}
        loading={channelInviteLoading}
        friends={channelInviteCandidates}
        invitingUserId={channelInviteSendingUserId}
        title={text.channelInviteTitle}
        emptyLabel={text.channelInviteEmpty}
        inviteLabel={text.channelInvite}
        closeLabel={text.close}
        onClose={closeChannelInviteModal}
        onInvite={(userId) => {
          inviteFriendToChannel(userId).catch(() => undefined);
        }}
      />

      <UserProfileModal
        open={userProfileOpen}
        profile={selectedUserProfile}
        loading={userProfileLoading}
        actionLoading={userProfileActionSaving}
        title={text.userProfileTitle}
        nicknameLabel={text.profileUsername}
        bioLabel={text.profileBio}
        blockLabel={text.blockUser}
        unblockLabel={text.unblockUser}
        blockingLabel={text.blockSaving}
        closeLabel={text.close}
        onClose={closeUserProfile}
        onToggleBlock={() => {
          toggleUserBlock().catch(() => undefined);
        }}
      />

      <SettingsModal
        open={settingsOpen}
        theme={theme}
        language={language}
        fontSize={fontSize}
        notificationsEnabled={notificationsEnabled}
        callSoundsEnabled={callSoundsEnabled}
        profileUsername={profileUsername}
        profileAvatarUrl={profileAvatarUrl}
        profileBio={profileBio}
        profileSaving={profileSaving}
        title={text.settingsTitle}
        profileSectionTitle={text.profileSectionTitle}
        usernameLabel={text.profileUsername}
        avatarUrlLabel={text.profileAvatarUrl}
        avatarDropLabel={text.profileAvatarDrop}
        avatarChooseLabel={text.profileAvatarChoose}
        avatarRemoveLabel={text.profileAvatarRemove}
        avatarHintLabel={text.profileAvatarHint}
        bioLabel={text.profileBio}
        saveProfileLabel={text.profileSave}
        savingProfileLabel={text.profileSaving}
        closeLabel={text.close}
        themeLabel={text.theme}
        notificationsLabel={text.notifications}
        callSoundsLabel={text.callSounds}
        enabledLabel={text.enabled}
        disabledLabel={text.disabled}
        languageLabel={text.language}
        fontSizeLabel={text.fontSize}
        lightLabel={text.light}
        darkLabel={text.dark}
        languageRuLabel={text.languageRu}
        languageEnLabel={text.languageEn}
        fontSmallLabel={text.fontSmall}
        fontMediumLabel={text.fontMedium}
        fontLargeLabel={text.fontLarge}
        onChangeProfileUsername={setProfileUsername}
        onChangeProfileAvatarUrl={setProfileAvatarUrl}
        onChangeProfileBio={setProfileBio}
        onSaveProfile={() => {
          saveProfile().catch(() => undefined);
        }}
        onClose={() => setSettingsOpen(false)}
        onToggleTheme={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
        onToggleNotifications={toggleNotifications}
        onToggleCallSounds={() => setCallSoundsEnabled((current) => !current)}
        onChangeLanguage={setLanguage}
        onChangeFontSize={setFontSize}
      />
    </main>
  );
}
