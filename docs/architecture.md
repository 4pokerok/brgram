# brgram Architecture

## Product Goal

`brgram` is a Telegram-class messenger architecture that starts with a web MVP and grows to mobile and desktop clients.

## Current MVP (implemented)

- Auth: JWT-based register/login
- Text channels: create channel, history, realtime messaging
- Voice channels: WebRTC mesh with Socket.IO signaling
- Backend: Fastify API + Socket.IO + Prisma + PostgreSQL
- Frontend: React + Vite single-page app

## Service Boundaries (target architecture)

1. API Gateway
- HTTP APIs, auth, rate limits
- Session/token lifecycle and policy checks

2. Realtime Gateway
- WebSocket cluster (Socket.IO or pure WS)
- Fanout of messages, typing, read receipts, presence

3. Messaging Service
- Message persistence, edits/deletes, reactions
- Delivery status and ordering guarantees

4. Media/Voice Service
- MVP: mesh WebRTC (already present)
- Scale path: SFU (LiveKit/mediasoup) for voice rooms and group calls

5. Search Service
- Full text index (OpenSearch/Meilisearch)
- Message/channel search with ACL filtering

6. Notification Service
- Push (APNs/FCM/WebPush), email, in-app notifications

## Data Model (current)

- `User`: identity and credentials
- `Channel`: text/voice channels
- `Message`: channel messages and author relation

## Security Baseline

- Password hashing with bcrypt
- Signed JWT access tokens
- CORS isolation by environment
- Input validation with Zod

## Scalability Plan

1. Realtime horizontal scaling
- Add Redis adapter for Socket.IO pub/sub
- Sticky sessions at load balancer layer

2. Voice scaling
- Keep mesh for small rooms (<=6)
- Introduce SFU for larger channels and reduced client CPU/network cost

3. Database scaling
- Read replicas for timeline/read-heavy APIs
- Partitioning by channel/message volume if needed

4. Storage and media
- S3-compatible object storage for files/avatars/voice notes
- CDN for static and media delivery

5. Reliability
- Queue (Kafka/RabbitMQ) for background fanout and push notifications
- Observability: OpenTelemetry + Prometheus + Grafana

## Deployment Topology (recommended)

- Dev: Docker Compose
- Stage/Prod:
  - API and Realtime containers on Kubernetes or Nomad
  - Managed Postgres + Redis
  - Managed object storage + CDN
  - Global TLS termination with WAF

## Cross-Platform Path

- Web: React (already implemented)
- iOS/Android: React Native sharing API contracts and domain logic
- macOS/Windows: Tauri (Rust shell + Web UI) or Electron for faster iteration
- Shared SDK: TypeScript client package for API/socket events

## Next Critical Features

1. DMs, groups, and role-based permissions
2. Attachments and media uploads
3. Message edits/deletes/reactions
4. Presence, typing, read receipts
5. End-to-end encryption strategy for private chats
