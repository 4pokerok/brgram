import type { User } from "../types";

type ChannelInviteModalProps = {
  open: boolean;
  loading: boolean;
  friends: User[];
  invitingUserId: string | null;
  title: string;
  emptyLabel: string;
  inviteLabel: string;
  closeLabel: string;
  onClose: () => void;
  onInvite: (userId: string) => void;
};

export function ChannelInviteModal({
  open,
  loading,
  friends,
  invitingUserId,
  title,
  emptyLabel,
  inviteLabel,
  closeLabel,
  onClose,
  onInvite,
}: ChannelInviteModalProps) {
  if (!open) return null;

  return (
    <div className="settings-overlay" onClick={onClose}>
      <section
        className="settings-modal channel-invite-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="settings-header">
          <h3>{title}</h3>
          <button className="ghost-button" onClick={onClose}>
            {closeLabel}
          </button>
        </header>

        {loading ? (
          <p className="user-profile-loading">...</p>
        ) : friends.length === 0 ? (
          <p className="user-profile-loading">{emptyLabel}</p>
        ) : (
          <div className="invite-list">
            {friends.map((friend) => (
              <div key={friend.id} className="invite-item">
                <span className="list-user">
                  <span className="list-avatar">
                    {friend.avatarUrl ? (
                      <img src={friend.avatarUrl} alt={friend.username} loading="lazy" />
                    ) : (
                      friend.username[0]?.toUpperCase() ?? "U"
                    )}
                  </span>
                  <span>{friend.username}</span>
                </span>
                <button disabled={invitingUserId === friend.id} onClick={() => onInvite(friend.id)}>
                  {inviteLabel}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
