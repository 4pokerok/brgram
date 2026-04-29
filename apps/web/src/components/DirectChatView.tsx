import { useEffect, useRef } from "react";
import type { DirectChat, DirectMessage } from "../types";
import { MessageAttachment } from "./MessageAttachment";

function AttachFileIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M16.5 6.5a4.5 4.5 0 0 0-6.36 0l-5.3 5.3a3.5 3.5 0 1 0 4.95 4.95l5.12-5.12a2.5 2.5 0 0 0-3.54-3.54l-5.12 5.12a1 1 0 0 0 1.41 1.42l5.13-5.13a.5.5 0 0 1 .7.71l-5.11 5.12a1.5 1.5 0 1 1-2.13-2.13l5.3-5.3a2.5 2.5 0 0 1 3.54 3.53l-6.72 6.73a4 4 0 0 1-5.66-5.66l5.65-5.66a1 1 0 1 0-1.41-1.41l-5.66 5.65a6 6 0 0 0 8.49 8.49l6.72-6.72a4.5 4.5 0 0 0 0-6.36Z"
      />
    </svg>
  );
}

type DirectChatViewProps = {
  chat: DirectChat;
  meId: string;
  messages: DirectMessage[];
  draft: string;
  youLabel: string;
  sendLabel: string;
  messagePlaceholderPrefix: string;
  attachFileLabel: string;
  removeFileLabel: string;
  uploadingFileLabel: string;
  pendingAttachmentName: string | null;
  uploadingAttachment: boolean;
  onDraftChange: (value: string) => void;
  onSendMessage: () => void;
  onAttachFile: (file: File) => void;
  onRemoveAttachment: () => void;
};

export function DirectChatView({
  chat,
  meId,
  messages,
  draft,
  youLabel,
  sendLabel,
  messagePlaceholderPrefix,
  attachFileLabel,
  removeFileLabel,
  uploadingFileLabel,
  pendingAttachmentName,
  uploadingAttachment,
  onDraftChange,
  onSendMessage,
  onAttachFile,
  onRemoveAttachment,
}: DirectChatViewProps) {
  const endRef = useRef<HTMLDivElement | null>(null);
  const attachmentFileInputRef = useRef<HTMLInputElement | null>(null);
  const canSend = draft.trim().length > 0 || Boolean(pendingAttachmentName);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <section className="main-panel">
      <div className="messages-list">
        {messages.map((message) => {
          const isMe = message.authorId === meId;
          return (
            <article key={message.id} className={isMe ? "message-item me" : "message-item"}>
              <div className="message-meta">
                <strong>{isMe ? youLabel : message.author.username}</strong>
                <span>{new Date(message.createdAt).toLocaleTimeString()}</span>
              </div>
              {message.content ? <p>{message.content}</p> : null}
              {message.attachment ? <MessageAttachment attachment={message.attachment} /> : null}
            </article>
          );
        })}
        <div ref={endRef} />
      </div>

      <div className="composer">
        <input
          ref={attachmentFileInputRef}
          type="file"
          className="composer-file-input"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            onAttachFile(file);
            event.currentTarget.value = "";
          }}
        />
        <button
          type="button"
          className="composer-icon-button"
          onClick={() => attachmentFileInputRef.current?.click()}
          aria-label={attachFileLabel}
          title={attachFileLabel}
          disabled={uploadingAttachment}
        >
          <AttachFileIcon />
        </button>
        <input
          type="text"
          value={draft}
          disabled={uploadingAttachment}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder={`${messagePlaceholderPrefix} ${chat.peer.username}`}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onSendMessage();
            }
          }}
        />
        <button className="composer-send-button" onClick={onSendMessage} disabled={!canSend || uploadingAttachment}>
          {sendLabel}
        </button>
      </div>
      {uploadingAttachment || pendingAttachmentName ? (
        <div className="composer-file-status">
          <span>{uploadingAttachment ? uploadingFileLabel : pendingAttachmentName}</span>
          {!uploadingAttachment && pendingAttachmentName ? (
            <button type="button" className="ghost-button" onClick={onRemoveAttachment}>
              {removeFileLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
