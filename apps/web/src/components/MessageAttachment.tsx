import { formatAttachmentSize, resolveAttachmentUrl } from "../lib/attachments";
import type { MessageAttachment as MessageAttachmentType } from "../types";

type MessageAttachmentProps = {
  attachment: MessageAttachmentType;
};

function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M14 2H7a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V8l-6-6Zm0 2.5L17.5 8H14V4.5ZM8 12a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2H9a1 1 0 0 1-1-1Zm1 3a1 1 0 1 0 0 2h6a1 1 0 1 0 0-2H9Z"
      />
    </svg>
  );
}

export function MessageAttachment({ attachment }: MessageAttachmentProps) {
  const href = resolveAttachmentUrl(attachment.url);
  const details = [formatAttachmentSize(attachment.size), attachment.mimeType].filter(Boolean).join(" · ");

  return (
    <a
      className="message-attachment"
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      download={attachment.name}
      title={attachment.name}
    >
      <span className="message-attachment-icon">
        <FileIcon />
      </span>
      <span className="message-attachment-meta">
        <strong>{attachment.name}</strong>
        <small>{details}</small>
      </span>
    </a>
  );
}
