import { useRef, useState } from "react";

type SettingsModalProps = {
  open: boolean;
  theme: "light" | "dark";
  language: "ru" | "en";
  fontSize: "sm" | "md" | "lg";
  notificationsEnabled: boolean;
  callSoundsEnabled: boolean;
  profileUsername: string;
  profileAvatarUrl: string;
  profileBio: string;
  profileSaving: boolean;
  title: string;
  profileSectionTitle: string;
  usernameLabel: string;
  avatarUrlLabel: string;
  avatarDropLabel: string;
  avatarChooseLabel: string;
  avatarRemoveLabel: string;
  avatarHintLabel: string;
  bioLabel: string;
  saveProfileLabel: string;
  savingProfileLabel: string;
  closeLabel: string;
  themeLabel: string;
  notificationsLabel: string;
  callSoundsLabel: string;
  enabledLabel: string;
  disabledLabel: string;
  languageLabel: string;
  fontSizeLabel: string;
  lightLabel: string;
  darkLabel: string;
  languageRuLabel: string;
  languageEnLabel: string;
  fontSmallLabel: string;
  fontMediumLabel: string;
  fontLargeLabel: string;
  onChangeProfileUsername: (value: string) => void;
  onChangeProfileAvatarUrl: (value: string) => void;
  onChangeProfileBio: (value: string) => void;
  onSaveProfile: () => void;
  onClose: () => void;
  onToggleTheme: () => void;
  onToggleNotifications: () => void;
  onToggleCallSounds: () => void;
  onChangeLanguage: (value: "ru" | "en") => void;
  onChangeFontSize: (value: "sm" | "md" | "lg") => void;
};

export function SettingsModal({
  open,
  theme,
  language,
  fontSize,
  notificationsEnabled,
  callSoundsEnabled,
  profileUsername,
  profileAvatarUrl,
  profileBio,
  profileSaving,
  title,
  profileSectionTitle,
  usernameLabel,
  avatarUrlLabel,
  avatarDropLabel,
  avatarChooseLabel,
  avatarRemoveLabel,
  avatarHintLabel,
  bioLabel,
  saveProfileLabel,
  savingProfileLabel,
  closeLabel,
  themeLabel,
  notificationsLabel,
  callSoundsLabel,
  enabledLabel,
  disabledLabel,
  languageLabel,
  fontSizeLabel,
  lightLabel,
  darkLabel,
  languageRuLabel,
  languageEnLabel,
  fontSmallLabel,
  fontMediumLabel,
  fontLargeLabel,
  onChangeProfileUsername,
  onChangeProfileAvatarUrl,
  onChangeProfileBio,
  onSaveProfile,
  onClose,
  onToggleTheme,
  onToggleNotifications,
  onToggleCallSounds,
  onChangeLanguage,
  onChangeFontSize,
}: SettingsModalProps) {
  const [avatarDropActive, setAvatarDropActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!open) return null;

  function applyAvatarFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 2 * 1024 * 1024) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        onChangeProfileAvatarUrl(result);
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="settings-overlay" onClick={onClose}>
      <section
        className="settings-modal"
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

        <div className="settings-body">
          <div className="settings-section">
            <h4>{profileSectionTitle}</h4>

            <div className="settings-field">
              <label>{usernameLabel}</label>
              <input
                className="settings-input"
                type="text"
                value={profileUsername}
                onChange={(event) => onChangeProfileUsername(event.target.value)}
                minLength={3}
                maxLength={20}
                title="Use only letters, numbers, _ and -"
              />
            </div>

            <div className="settings-field">
              <label>{avatarUrlLabel}</label>
              <input
                className="settings-input"
                type="text"
                value={profileAvatarUrl}
                onChange={(event) => onChangeProfileAvatarUrl(event.target.value)}
                placeholder="https://..."
              />
              <div
                className={avatarDropActive ? "avatar-dropzone active" : "avatar-dropzone"}
                onDragOver={(event) => {
                  event.preventDefault();
                  setAvatarDropActive(true);
                }}
                onDragLeave={() => setAvatarDropActive(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setAvatarDropActive(false);
                  const file = event.dataTransfer.files?.[0];
                  if (!file) return;
                  applyAvatarFile(file);
                }}
              >
                <p>{avatarDropLabel}</p>
                <small>{avatarHintLabel}</small>
                <div className="avatar-drop-actions">
                  <button type="button" onClick={() => fileInputRef.current?.click()}>
                    {avatarChooseLabel}
                  </button>
                  <button type="button" className="ghost-button" onClick={() => onChangeProfileAvatarUrl("")}>
                    {avatarRemoveLabel}
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="avatar-file-input"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    applyAvatarFile(file);
                    event.currentTarget.value = "";
                  }}
                />
              </div>
              {profileAvatarUrl ? (
                <div className="settings-avatar-preview">
                  <img src={profileAvatarUrl} alt={profileUsername || "avatar"} />
                </div>
              ) : null}
            </div>

            <div className="settings-field">
              <label>{bioLabel}</label>
              <textarea
                className="settings-input settings-textarea"
                value={profileBio}
                onChange={(event) => onChangeProfileBio(event.target.value)}
                maxLength={200}
                rows={3}
              />
            </div>

            <button onClick={onSaveProfile} disabled={profileSaving}>
              {profileSaving ? savingProfileLabel : saveProfileLabel}
            </button>
          </div>

          <div className="settings-row">
            <label>{themeLabel}</label>
            <button
              className={theme === "dark" ? "theme-toggle is-dark" : "theme-toggle"}
              onClick={onToggleTheme}
              aria-label={theme === "light" ? darkLabel : lightLabel}
              title={theme === "light" ? darkLabel : lightLabel}
            >
              <span className="theme-toggle-track" aria-hidden="true">
                <span className="theme-toggle-thumb" />
              </span>
            </button>
          </div>

          <div className="settings-row">
            <label>{notificationsLabel}</label>
            <button className="ghost-button" onClick={onToggleNotifications}>
              {notificationsEnabled ? enabledLabel : disabledLabel}
            </button>
          </div>

          <div className="settings-row">
            <label>{callSoundsLabel}</label>
            <button className="ghost-button" onClick={onToggleCallSounds}>
              {callSoundsEnabled ? enabledLabel : disabledLabel}
            </button>
          </div>

          <div className="settings-row">
            <label>{languageLabel}</label>
            <select
              className="settings-select"
              value={language}
              onChange={(event) => onChangeLanguage(event.target.value as "ru" | "en")}
            >
              <option value="ru">{languageRuLabel}</option>
              <option value="en">{languageEnLabel}</option>
            </select>
          </div>

          <div className="settings-row">
            <label>{fontSizeLabel}</label>
            <select
              className="settings-select"
              value={fontSize}
              onChange={(event) => onChangeFontSize(event.target.value as "sm" | "md" | "lg")}
            >
              <option value="sm">{fontSmallLabel}</option>
              <option value="md">{fontMediumLabel}</option>
              <option value="lg">{fontLargeLabel}</option>
            </select>
          </div>
        </div>
      </section>
    </div>
  );
}
