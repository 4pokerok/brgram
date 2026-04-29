type ActiveCallParticipant = {
  id: string;
  username: string;
  avatarUrl: string | null;
};

type ActiveCallBarProps = {
  avatarUrl: string | null;
  title: string;
  participants: ActiveCallParticipant[];
  compactAvatarUrl?: string | null;
  compactAvatarName?: string | null;
  participantsLabel: string;
  connected: boolean;
  callLocked: boolean;
  callLockedLabel: string;
  muted: boolean;
  notificationsMuted: boolean;
  joinLabel: string;
  leaveLabel: string;
  muteLabel: string;
  unmuteLabel: string;
  muteNotificationsLabel: string;
  unmuteNotificationsLabel: string;
  onJoin: () => void;
  onLeave: () => void;
  onToggleMute: () => void;
  onToggleNotifications: () => void;
};

function MicrophoneIcon({ muted }: { muted: boolean }) {
  if (!muted) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 15a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Zm5-3a1 1 0 1 1 2 0 7 7 0 0 1-6 6.93V21h2a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2h2v-2.07A7 7 0 0 1 5 12a1 1 0 0 1 2 0 5 5 0 1 0 10 0Z"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M5.71 4.29a1 1 0 0 0-1.42 1.42l13.99 14a1 1 0 0 0 1.42-1.42l-2.27-2.27A6.95 6.95 0 0 0 19 12a1 1 0 1 0-2 0 4.96 4.96 0 0 1-.99 3l-2.13-2.13c.7-.53 1.12-1.36 1.12-2.27V7a3 3 0 1 0-6 0v.59l-3.29-3.3ZM11 9.59V7a1 1 0 1 1 2 0v3.59L11 8.6v.99ZM7 12a1 1 0 1 0-2 0 7 7 0 0 0 6 6.93V21H9a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2h-2v-2.07a6.98 6.98 0 0 0 2.99-1.23l-1.44-1.44A4.95 4.95 0 0 1 12 17a5 5 0 0 1-5-5Z"
      />
    </svg>
  );
}

function JoinCallIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1C10.61 21 3 13.39 3 4c0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.24.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2Z"
      />
    </svg>
  );
}

function LeaveCallIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 7c-4.2 0-8.03 1.54-10.96 4.08a1 1 0 0 0-.07 1.44l2.6 2.6a1 1 0 0 0 1.35.06l2.4-1.9a1 1 0 0 1 1.08-.1 7.93 7.93 0 0 0 7.2 0 1 1 0 0 1 1.08.1l2.4 1.9a1 1 0 0 0 1.35-.06l2.6-2.6a1 1 0 0 0-.07-1.44A16.46 16.46 0 0 0 12 7Z"
      />
    </svg>
  );
}

function NotificationIcon({ muted }: { muted: boolean }) {
  if (!muted) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 2a6 6 0 0 0-6 6v3.59l-.7 1.4A2 2 0 0 0 7.09 16h9.82a2 2 0 0 0 1.79-2.99L18 11.6V8a6 6 0 0 0-6-6Zm0 20a3 3 0 0 0 2.82-2H9.18A3 3 0 0 0 12 22Z"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M3.29 4.71a1 1 0 1 1 1.42-1.42l16 16a1 1 0 1 1-1.42 1.42l-2.08-2.08A2 2 0 0 1 16.91 19H7.1a2 2 0 0 1-1.78-2.89L6 14.77V8a6 6 0 0 1 9.49-4.9l-1.44 1.44A4 4 0 0 0 8 8v7a1 1 0 0 1-.1.45l-.72 1.45a.08.08 0 0 0 .07.1h8.5l-2.06-2.06c-.54.04-1.1.06-1.69.06a1 1 0 1 1 0-2c.12 0 .24 0 .36-.01L3.29 4.71ZM12 22a3 3 0 0 0 2.82-2H9.18A3 3 0 0 0 12 22Z"
      />
    </svg>
  );
}

export function ActiveCallBar({
  avatarUrl,
  title,
  participants,
  compactAvatarUrl,
  compactAvatarName,
  participantsLabel,
  connected,
  callLocked,
  callLockedLabel,
  muted,
  notificationsMuted,
  joinLabel,
  leaveLabel,
  muteLabel,
  unmuteLabel,
  muteNotificationsLabel,
  unmuteNotificationsLabel,
  onJoin,
  onLeave,
  onToggleMute,
  onToggleNotifications,
}: ActiveCallBarProps) {
  const callStatus = connected
    ? `${participantsLabel}: ${participants.length}`
    : callLocked
      ? callLockedLabel
      : null;
  const compactAvatarSrc = compactAvatarUrl ?? avatarUrl;
  const compactAvatarAlt = compactAvatarName ?? title;
  const stageParticipants =
    participants.length > 0
      ? participants
      : [
          {
            id: "active-call-fallback",
            username: compactAvatarAlt,
            avatarUrl: compactAvatarSrc ?? null,
          } satisfies ActiveCallParticipant,
        ];

  const controls = connected ? (
    <>
      <button
        type="button"
        className="active-call-icon-button"
        onClick={onToggleNotifications}
        title={notificationsMuted ? unmuteNotificationsLabel : muteNotificationsLabel}
        aria-label={notificationsMuted ? unmuteNotificationsLabel : muteNotificationsLabel}
      >
        <NotificationIcon muted={notificationsMuted} />
        <span className="sr-only">{notificationsMuted ? unmuteNotificationsLabel : muteNotificationsLabel}</span>
      </button>
      <button
        type="button"
        className="active-call-icon-button"
        onClick={onToggleMute}
        title={muted ? unmuteLabel : muteLabel}
        aria-label={muted ? unmuteLabel : muteLabel}
      >
        <MicrophoneIcon muted={muted} />
        <span className="sr-only">{muted ? unmuteLabel : muteLabel}</span>
      </button>
      <button
        type="button"
        className="active-call-icon-button danger"
        onClick={onLeave}
        title={leaveLabel}
        aria-label={leaveLabel}
      >
        <LeaveCallIcon />
        <span className="sr-only">{leaveLabel}</span>
      </button>
    </>
  ) : (
    <>
      <button
        type="button"
        className="active-call-icon-button"
        onClick={onToggleNotifications}
        title={notificationsMuted ? unmuteNotificationsLabel : muteNotificationsLabel}
        aria-label={notificationsMuted ? unmuteNotificationsLabel : muteNotificationsLabel}
      >
        <NotificationIcon muted={notificationsMuted} />
        <span className="sr-only">{notificationsMuted ? unmuteNotificationsLabel : muteNotificationsLabel}</span>
      </button>
      <button
        type="button"
        className="active-call-icon-button join"
        onClick={onJoin}
        disabled={callLocked}
        title={callLocked ? callLockedLabel : joinLabel}
        aria-label={callLocked ? callLockedLabel : joinLabel}
      >
        <JoinCallIcon />
        <span className="sr-only">{callLocked ? callLockedLabel : joinLabel}</span>
      </button>
    </>
  );

  if (!connected) {
    return (
      <div className="active-call-bar compact" role="status" aria-live="polite">
        <div className="active-call-compact-meta">
          <span className="active-call-compact-avatar">
            {compactAvatarSrc ? (
              <img src={compactAvatarSrc} alt={compactAvatarAlt} loading="lazy" />
            ) : (
              compactAvatarAlt[0]?.toUpperCase() ?? "C"
            )}
          </span>
          <div className="active-call-compact-text">
            <strong>{title}</strong>
            {callStatus ? <span className="active-call-status">{callStatus}</span> : null}
          </div>
        </div>

        <div className="active-call-actions">{controls}</div>
      </div>
    );
  }

  return (
    <div className="active-call-bar stage" role="status" aria-live="polite">
      <div className="active-call-top">
        <strong>{title}</strong>
        {callStatus ? <span className="active-call-status">{callStatus}</span> : null}
      </div>

      <div className="active-call-center">
        {stageParticipants.map((participant) => (
          <span key={participant.id} className="active-call-stage-avatar" title={participant.username}>
            {participant.avatarUrl ? (
              <img src={participant.avatarUrl} alt={participant.username} loading="lazy" />
            ) : (
              participant.username[0]?.toUpperCase() ?? "U"
            )}
          </span>
        ))}
      </div>

      <div className="active-call-actions">{controls}</div>
    </div>
  );
}
