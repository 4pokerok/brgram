import type { PublicUserProfile } from "../types";

type UserProfileModalProps = {
  open: boolean;
  profile: PublicUserProfile | null;
  loading: boolean;
  actionLoading: boolean;
  title: string;
  nicknameLabel: string;
  bioLabel: string;
  blockLabel: string;
  unblockLabel: string;
  blockingLabel: string;
  closeLabel: string;
  onClose: () => void;
  onToggleBlock: () => void;
};

export function UserProfileModal({
  open,
  profile,
  loading,
  actionLoading,
  title,
  nicknameLabel,
  bioLabel,
  blockLabel,
  unblockLabel,
  blockingLabel,
  closeLabel,
  onClose,
  onToggleBlock,
}: UserProfileModalProps) {
  if (!open) return null;

  return (
    <div className="settings-overlay" onClick={onClose}>
      <section
        className="settings-modal user-profile-modal"
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
        ) : profile ? (
          <div className="user-profile-body">
            <div className="user-profile-avatar">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt={profile.username} loading="lazy" />
              ) : (
                profile.username[0]?.toUpperCase() ?? "U"
              )}
            </div>

            <div className="user-profile-row">
              <span>{nicknameLabel}</span>
              <strong>{profile.username}</strong>
            </div>

            <div className="user-profile-row">
              <span>{bioLabel}</span>
              <p>{profile.bio || "-"}</p>
            </div>

            <button className="danger" onClick={onToggleBlock} disabled={actionLoading}>
              {actionLoading ? blockingLabel : profile.isBlocked ? unblockLabel : blockLabel}
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
