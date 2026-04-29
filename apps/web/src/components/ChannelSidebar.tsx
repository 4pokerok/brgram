import { useEffect, useRef, useState } from "react";
import type { Channel, DirectChat, FriendRequest, User } from "../types";

type ChannelSidebarProps = {
  channels: Channel[];
  friends: User[];
  blockedUsers: User[];
  incomingRequests: FriendRequest[];
  outgoingRequests: FriendRequest[];
  directChats: DirectChat[];
  selectedChannelId: string | null;
  selectedDirectChatId: string | null;
  meId: string;
  meUsername: string;
  meAvatarUrl?: string | null;
  error: string | null;
  textChannelsLabel: string;
  settingsLabel: string;
  logoutLabel: string;
  friendsLabel: string;
  requestsLabel: string;
  blockedLabel: string;
  addFriendPrompt: string;
  addFriendLabel: string;
  removeFriendLabel: string;
  openProfileLabel: string;
  unblockLabel: string;
  acceptLabel: string;
  declineLabel: string;
  outgoingLabel: string;
  createTextPrompt: string;
  descriptionPrompt: string;
  leaveGroupLabel: string;
  deleteChannelLabel: string;
  onSelectChannel: (channel: Channel) => void;
  onCreateChannel: (name: string, description?: string) => void;
  onDeleteChannel: (channel: Channel) => void;
  onLeaveChannel: (channel: Channel) => void;
  onOpenUserProfile: (userId: string) => void;
  onRemoveFriend: (userId: string) => void;
  onUnblockUser: (userId: string) => void;
  onSelectDirectChat: (chat: DirectChat) => void;
  onAddFriend: (username: string) => void;
  onAcceptFriendRequest: (requestId: string) => void;
  onDeclineFriendRequest: (requestId: string) => void;
  onOpenSettings: () => void;
  onLogout: () => void;
};

export function ChannelSidebar({
  channels,
  friends,
  blockedUsers,
  incomingRequests,
  outgoingRequests,
  directChats,
  selectedChannelId,
  selectedDirectChatId,
  meId,
  meUsername,
  meAvatarUrl,
  error,
  textChannelsLabel,
  settingsLabel,
  logoutLabel,
  friendsLabel,
  requestsLabel,
  blockedLabel,
  addFriendPrompt,
  addFriendLabel,
  removeFriendLabel,
  openProfileLabel,
  unblockLabel,
  acceptLabel,
  declineLabel,
  outgoingLabel,
  createTextPrompt,
  descriptionPrompt,
  leaveGroupLabel,
  deleteChannelLabel,
  onSelectChannel,
  onCreateChannel,
  onDeleteChannel,
  onLeaveChannel,
  onOpenUserProfile,
  onRemoveFriend,
  onUnblockUser,
  onSelectDirectChat,
  onAddFriend,
  onAcceptFriendRequest,
  onDeclineFriendRequest,
  onOpenSettings,
  onLogout,
}: ChannelSidebarProps) {
  const [activeTab, setActiveTab] = useState<"chats" | "friends">("chats");
  const [channelContextMenu, setChannelContextMenu] = useState<{
    channel: Channel;
    canLeaveChannel: boolean;
    x: number;
    y: number;
  } | null>(null);
  const channelContextMenuRef = useRef<HTMLDivElement | null>(null);
  const [friendContextMenu, setFriendContextMenu] = useState<{
    friend: User;
    x: number;
    y: number;
  } | null>(null);
  const friendContextMenuRef = useRef<HTMLDivElement | null>(null);
  const safeChannels = Array.isArray(channels) ? channels : [];
  const safeDirectChats = Array.isArray(directChats) ? directChats : [];
  const safeFriends = Array.isArray(friends) ? friends : [];
  const safeIncomingRequests = Array.isArray(incomingRequests) ? incomingRequests : [];
  const safeOutgoingRequests = Array.isArray(outgoingRequests) ? outgoingRequests : [];
  const safeBlockedUsers = Array.isArray(blockedUsers) ? blockedUsers : [];
  const textChannels = safeChannels.filter((channel) => channel.type === "TEXT");

  useEffect(() => {
    if (!channelContextMenu && !friendContextMenu) return;

    function closeOnOutsideClick(event: PointerEvent) {
      if (!(event.target instanceof Node)) {
        setChannelContextMenu(null);
        setFriendContextMenu(null);
        return;
      }

      const channelMenuNode = channelContextMenuRef.current;
      const friendMenuNode = friendContextMenuRef.current;
      if (
        (channelMenuNode && channelMenuNode.contains(event.target)) ||
        (friendMenuNode && friendMenuNode.contains(event.target))
      ) {
        return;
      }
      setChannelContextMenu(null);
      setFriendContextMenu(null);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setChannelContextMenu(null);
        setFriendContextMenu(null);
      }
    }

    function closeOnViewportChange() {
      setChannelContextMenu(null);
      setFriendContextMenu(null);
    }

    window.addEventListener("pointerdown", closeOnOutsideClick);
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", closeOnViewportChange);
    window.addEventListener("scroll", closeOnViewportChange, true);

    return () => {
      window.removeEventListener("pointerdown", closeOnOutsideClick);
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", closeOnViewportChange);
      window.removeEventListener("scroll", closeOnViewportChange, true);
    };
  }, [channelContextMenu, friendContextMenu]);

  useEffect(() => {
    setChannelContextMenu(null);
    setFriendContextMenu(null);
  }, [activeTab]);

  function createChannel() {
    const name = prompt(createTextPrompt);
    if (!name) return;

    const description = prompt(descriptionPrompt) ?? undefined;
    onCreateChannel(name, description);
  }

  function addFriend() {
    const username = prompt(addFriendPrompt);
    if (!username) return;

    onAddFriend(username);
  }

  function renderAvatar(user: Pick<User, "username" | "avatarUrl">) {
    if (user.avatarUrl) {
      return (
        <span className="list-avatar">
          <img src={user.avatarUrl} alt={user.username} loading="lazy" />
        </span>
      );
    }

    return <span className="list-avatar">{user.username[0]?.toUpperCase() ?? "U"}</span>;
  }

  function renderChannelAvatar(channel: Pick<Channel, "name" | "avatarUrl">) {
    if (channel.avatarUrl) {
      return (
        <span className="list-avatar">
          <img src={channel.avatarUrl} alt={channel.name} loading="lazy" />
        </span>
      );
    }

    return <span className="list-avatar">{channel.name[0]?.toUpperCase() ?? "C"}</span>;
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <div className="sidebar-brand">
          <div className="brand-dot">B</div>
          <div>
            <strong>brgram</strong>
          </div>
        </div>

        <div className="sidebar-tabs" role="tablist" aria-label="Sidebar tabs">
          <button
            type="button"
            className={activeTab === "chats" ? "sidebar-tab active" : "sidebar-tab"}
            onClick={() => setActiveTab("chats")}
          >
            {textChannelsLabel}
          </button>
          <button
            type="button"
            className={activeTab === "friends" ? "sidebar-tab active" : "sidebar-tab"}
            onClick={() => setActiveTab("friends")}
          >
            {friendsLabel}
          </button>
        </div>
      </div>

      <div className="sidebar-scroll">
        {activeTab === "chats" ? (
          <div className="channel-section">
            <div className="channel-title-row">
              <h3>{textChannelsLabel}</h3>
              <button onClick={createChannel}>+</button>
            </div>
            <div className="channel-list">
              {safeDirectChats.map((chat) => (
                <button
                  key={chat.id}
                  className={selectedDirectChatId === chat.id ? "channel-item active" : "channel-item"}
                  onClick={() => onSelectDirectChat(chat)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    onOpenUserProfile(chat.peer.id);
                  }}
                >
                  <span className="list-user">
                    {renderAvatar(chat.peer)}
                    <span>{chat.peer.username}</span>
                  </span>
                </button>
              ))}

              {textChannels.map((channel) => {
                const canLeaveChannel =
                  channel.isPrivate === true && Boolean(channel.ownerId) && channel.ownerId !== meId;
                const isSelected = selectedChannelId === channel.id;

                return (
                  <div key={channel.id} className="channel-row channel-row--single">
                    <button
                      className={isSelected ? "channel-item active" : "channel-item"}
                      onClick={() => {
                        setChannelContextMenu(null);
                        setFriendContextMenu(null);
                        onSelectChannel(channel);
                      }}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        onSelectChannel(channel);
                        setFriendContextMenu(null);
                        setChannelContextMenu({
                          channel,
                          canLeaveChannel,
                          x: event.clientX,
                          y: event.clientY,
                        });
                      }}
                    >
                      <span className="list-user">
                        {renderChannelAvatar(channel)}
                        <span>{channel.name}</span>
                      </span>
                      <small>{channel._count?.messages ?? 0}</small>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <>
            <div className="channel-section">
              <div className="channel-title-row">
                <h3>{friendsLabel}</h3>
                <button onClick={addFriend}>+</button>
              </div>
              <div className="channel-list">
                {safeFriends.map((friend) => (
                  <div key={friend.id} className="channel-row channel-row--single">
                    <button
                      className="channel-item"
                      onClick={() => {
                        setChannelContextMenu(null);
                        setFriendContextMenu(null);
                      }}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        setChannelContextMenu(null);
                        setFriendContextMenu({
                          friend,
                          x: event.clientX,
                          y: event.clientY,
                        });
                      }}
                    >
                      <span className="list-user">
                        {renderAvatar(friend)}
                        <span>{friend.username}</span>
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="channel-section">
              <div className="channel-title-row">
                <h3>{requestsLabel}</h3>
              </div>
              <div className="request-list">
                {safeIncomingRequests.map((request) => (
                  <div key={request.id} className="request-item">
                    <span>{request.user.username}</span>
                    <div className="request-actions">
                      <button className="request-action" onClick={() => onAcceptFriendRequest(request.id)}>
                        {acceptLabel}
                      </button>
                      <button className="request-action" onClick={() => onDeclineFriendRequest(request.id)}>
                        {declineLabel}
                      </button>
                    </div>
                  </div>
                ))}

                {safeOutgoingRequests.map((request) => (
                  <div key={request.id} className="request-item">
                    <span>
                      {request.user.username} ({outgoingLabel})
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="channel-section">
              <div className="channel-title-row">
                <h3>{blockedLabel}</h3>
              </div>
              <div className="request-list">
                {safeBlockedUsers.map((blockedUser) => (
                  <div key={blockedUser.id} className="request-item">
                    <span>{blockedUser.username}</span>
                    <div className="request-actions">
                      <button className="request-action" onClick={() => onUnblockUser(blockedUser.id)}>
                        {unblockLabel}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="sidebar-bottom">
        <div className="me-box">
          <div className="me-avatar">
            {meAvatarUrl ? <img src={meAvatarUrl} alt={meUsername} loading="lazy" /> : meUsername[0]?.toUpperCase() ?? "U"}
          </div>
          <div>
            <strong>{meUsername}</strong>
          </div>
        </div>
        <button className="ghost-button" onClick={onOpenSettings}>
          {settingsLabel}
        </button>
        <button className="ghost-button" onClick={onLogout}>
          {logoutLabel}
        </button>
        {error ? <div className="error-box">{error}</div> : null}
      </div>

      {channelContextMenu ? (
        <div
          ref={channelContextMenuRef}
          className="channel-context-menu"
          style={{
            top: channelContextMenu.y,
            left: channelContextMenu.x,
          }}
          role="menu"
          aria-label={channelContextMenu.channel.name}
        >
          <button
            type="button"
            className={channelContextMenu.canLeaveChannel ? "context-action danger" : "context-action"}
            onClick={() => {
              if (channelContextMenu.canLeaveChannel) {
                onLeaveChannel(channelContextMenu.channel);
              } else {
                onDeleteChannel(channelContextMenu.channel);
              }
              setChannelContextMenu(null);
            }}
          >
            {channelContextMenu.canLeaveChannel ? leaveGroupLabel : deleteChannelLabel}
          </button>
        </div>
      ) : null}

      {friendContextMenu ? (
        <div
          ref={friendContextMenuRef}
          className="channel-context-menu"
          style={{
            top: friendContextMenu.y,
            left: friendContextMenu.x,
          }}
          role="menu"
          aria-label={friendContextMenu.friend.username}
        >
          <button
            type="button"
            className="context-action"
            onClick={() => {
              onOpenUserProfile(friendContextMenu.friend.id);
              setFriendContextMenu(null);
            }}
          >
            {openProfileLabel}
          </button>
          <button
            type="button"
            className="context-action danger"
            onClick={() => {
              onRemoveFriend(friendContextMenu.friend.id);
              setFriendContextMenu(null);
            }}
          >
            {removeFriendLabel}
          </button>
        </div>
      ) : null}
    </aside>
  );
}
