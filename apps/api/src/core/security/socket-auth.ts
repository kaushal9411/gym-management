import { jwtService, type AccessTokenClaims } from './jwt.service';

/**
 * Socket.IO authentication building block — "authentication ready" per the
 * platform tech stack. The actual realtime gateway lives in a separate
 * deployable (apps/realtime, see docs/architecture/ARCHITECTURE.md §20)
 * which doesn't exist yet; this is the verifier that gateway will import,
 * kept here since it's pure JWT logic with no socket-server dependency.
 *
 * Usage (future apps/realtime):
 *   io.use((socket, next) => {
 *     try {
 *       socket.data.auth = verifySocketHandshakeToken(socket.handshake.auth.token);
 *       next();
 *     } catch (err) { next(err as Error); }
 *   });
 */
export function verifySocketHandshakeToken(token: string | undefined): AccessTokenClaims {
  if (!token) {
    throw new Error('Missing authentication token in socket handshake');
  }
  // Same RS256 public-key verification as HTTP requests — one source of truth.
  return jwtService.verifyAccessToken(token);
}
