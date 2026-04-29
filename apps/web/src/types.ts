export type User = {
  id: string;
  email: string;
  username: string;
  avatarUrl?: string | null;
  bio?: string | null;
};

export type PublicUserProfile = {
  id: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
  isBlocked: boolean;
};

export type ChannelType = "TEXT" | "VOICE";

export type Channel = {
  id: string;
  name: string;
  description?: string | null;
  avatarUrl?: string | null;
  ownerId?: string | null;
  isPrivate?: boolean;
  type: ChannelType;
  createdAt: string;
  updatedAt: string;
  _count?: {
    messages: number;
  };
};

export type MessageAttachment = {
  url: string;
  name: string;
  size: number;
  mimeType: string | null;
};

export type Message = {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  attachment?: MessageAttachment | null;
  createdAt: string;
  author: User;
};

export type AuthResponse = {
  token: string;
  user: User;
};

export type VoiceParticipant = {
  id: string;
  username: string;
};

export type FriendRequest = {
  id: string;
  createdAt: string;
  user: User;
};

export type FriendsResponse = {
  friends: User[];
  blockedUsers: User[];
  incomingRequests: FriendRequest[];
  outgoingRequests: FriendRequest[];
};

export type DirectMessage = {
  id: string;
  chatId: string;
  authorId: string;
  content: string;
  attachment?: MessageAttachment | null;
  createdAt: string;
  author: User;
};

export type DirectChat = {
  id: string;
  createdAt: string;
  updatedAt: string;
  peer: User;
  lastMessage?: {
    id: string;
    content: string;
    createdAt: string;
    authorId: string;
  } | null;
};
