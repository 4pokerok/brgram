import { useMemo } from "react";
import type { Channel, VoiceParticipant } from "../types";

type VoiceViewProps = {
  channel: Channel;
  meId: string;
  participants: VoiceParticipant[];
  connected: boolean;
  voiceChannelFallback: string;
  voiceConnectedHint: string;
  voiceJoinHint: string;
  leaveVoiceLabel: string;
  joinVoiceLabel: string;
  participantsLabel: string;
  youLabel: string;
  onJoin: () => void;
  onLeave: () => void;
};

export function VoiceView({
  channel,
  meId,
  participants,
  connected,
  voiceChannelFallback,
  voiceConnectedHint,
  voiceJoinHint,
  leaveVoiceLabel,
  joinVoiceLabel,
  participantsLabel,
  youLabel,
  onJoin,
  onLeave,
}: VoiceViewProps) {
  const participantNames = useMemo(
    () =>
      participants.map((participant) =>
        participant.id === meId ? `${participant.username} (${youLabel.toLowerCase()})` : participant.username
      ),
    [participants, meId, youLabel]
  );

  return (
    <section className="main-panel">
      <header className="panel-header">
        <h3>🔊 {channel.name}</h3>
        <span>{channel.description ?? voiceChannelFallback}</span>
      </header>

      <div className="voice-panel">
        <p>{connected ? voiceConnectedHint : voiceJoinHint}</p>

        <div className="voice-actions">
          {connected ? (
            <button className="danger" onClick={onLeave}>
              {leaveVoiceLabel}
            </button>
          ) : (
            <button onClick={onJoin}>{joinVoiceLabel}</button>
          )}
        </div>

        <h4>
          {participantsLabel} ({participantNames.length})
        </h4>
        <ul className="participants-list">
          {participantNames.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
