import type { AuthenticatedRequest, AppSession } from '@mentra/sdk';
import { AppServer } from '@mentra/sdk';
import express, { type Response } from 'express';
import path from 'path';

/**
 * Sets up all Express routes and middleware for the server
 * @param server The server instance
 */
export function setupExpressRoutes(server: AppServer): void {
  // Get the Express app instance
  const app = server.getExpressApp();
  // JSON parser for API routes
  app.use(express.json());

  // Set up EJS as the view engine
  app.set('view engine', 'ejs');
  app.engine('ejs', require('ejs').__express);
  app.set('views', path.join(__dirname, 'views'));

  // Register a route for handling webview requests
  app.get('/webview', (req: AuthenticatedRequest, res: any) => {
    if (req.authUserId) {
      // Render the webview template
      res.render('webview', {
        userId: req.authUserId,
        hasActiveSession: req.activeSession !== null,
        streamType: req.activeSession?.streamType,
        streamStatus: req.activeSession?.streamStatus,
        directRtmpUrl: req.activeSession?.directRtmpUrl,
        error: req.activeSession?.error,
        // Pass saved configuration
        customRtmpUrl: req.activeSession?.customRtmpUrl ?? '',
      });
    } else {
      res.redirect('/mentra-auth');
    }
  });

  // Server-Sent Events endpoint for real-time stream status updates
  app.get('/stream-status', (req: any, res: any) => {
    if (!req.authUserId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Prepare SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // Let the client know how long to wait before retrying
    res.write('retry: 3000\n\n');

    // Send initial status immediately
    const initial = formatStreamStatus(req.activeSession ?? undefined);
    writeSseEvent(res, 'status', initial);

    // Track the connection for this user
    const userId = req.authUserId;
    let clientSet = sseClientsByUser.get(userId);
    if (!clientSet) {
      clientSet = new Set<Response>();
      sseClientsByUser.set(userId, clientSet);
    }
    clientSet.add(res);

    // Heartbeat to keep proxies from closing the connection
    const heartbeat = setInterval(() => {
      try {
        res.write(': keep-alive\n\n');
      } catch {
        // No-op; close will clean up
      }
    }, 15000);

    // Periodic status pings so clients can reflect session availability even without stream events
    const statusPing = setInterval(() => {
      try {
        const snapshot = formatStreamStatus(req.activeSession ?? undefined);
        // Avoid flicker: if there was a recent successful heartbeat write, do not force a snapshot too frequently
        writeSseEvent(res, 'status', snapshot);
      } catch {
        // Ignore write errors; close will clean up
      }
    }, 20000);

    // Clean up on client disconnect
    req.on('close', () => {
      clearInterval(heartbeat);
      clearInterval(statusPing);
      const set = sseClientsByUser.get(userId);
      if (set) {
        set.delete(res);
        if (set.size === 0) {
          sseClientsByUser.delete(userId);
        }
      }
    });
  });

  // API: Start RTMP stream
  app.post('/api/stream/start', async (req: any, res: any) => {
    try {
      if (!req.authUserId || !req.activeSession) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const rtmpUrl: string | undefined = req.body?.rtmpUrl;
      if (!rtmpUrl) {
        res.status(400).json({ ok: false, error: 'Missing rtmpUrl' });
        return;
      }
      
      // Save configuration
      req.activeSession.customRtmpUrl = rtmpUrl;

      await req.activeSession.camera.startStream({ rtmpUrl });
      broadcastStreamStatus(req.authUserId, formatStreamStatus(req.activeSession));
      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ ok: false, error: String(err?.message ?? err) });
    }
  });

  // API: Stop RTMP stream
  app.post('/api/stream/stop', async (req: any, res: any) => {
    try {
      if (!req.authUserId || !req.activeSession) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      
      // First check if there's an existing stream to stop
      const streamInfo = await req.activeSession.camera.checkExistingStream();
      
      if (streamInfo.hasActiveStream && streamInfo.streamInfo?.type === 'unmanaged') {
        // There is an unmanaged stream, try to stop it
        await req.activeSession.camera.stopStream();
        req.activeSession.streamType = null;
        req.activeSession.streamStatus = 'idle';
        req.activeSession.directRtmpUrl = null;
        req.activeSession.streamId = null;
        broadcastStreamStatus(req.authUserId, formatStreamStatus(req.activeSession));
        res.json({ ok: true });
      } else {
        // No stream found
        console.log('No stream found to stop');
        req.activeSession.streamType = null;
        req.activeSession.streamStatus = 'idle';
        broadcastStreamStatus(req.authUserId, formatStreamStatus(req.activeSession));
        res.json({ ok: true, message: 'No stream to stop' });
      }
    } catch (err: any) {
      console.error('Error stopping stream:', err);
      // Even if stop fails, update UI to reflect no stream
      if (req.activeSession) {
        req.activeSession.streamType = null;
        req.activeSession.streamStatus = 'idle';
        broadcastStreamStatus(req.authUserId, formatStreamStatus(req.activeSession));
      }
      res.status(400).json({ ok: false, error: String(err?.message ?? err) });
    }
  });

  // API: Check for existing streams
  app.get('/api/stream/check', async (req: AuthenticatedRequest, res: any) => {
    try {
      if (!req.authUserId || !req.activeSession) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      
      const streamInfo = await (req.activeSession as AppSession).camera.checkExistingStream();
      
      if (streamInfo.hasActiveStream && streamInfo.streamInfo) {
        // Update session state with existing stream info
        const session = req.activeSession;
        
        if (streamInfo.streamInfo.type === 'unmanaged') {
          session.streamType = 'unmanaged';
          session.streamStatus = streamInfo.streamInfo.status || 'active';
          session.streamId = streamInfo.streamInfo.streamId || null;
          session.directRtmpUrl = streamInfo.streamInfo.rtmpUrl || null;
          session.error = null;
        }
        
        // Broadcast updated status
        broadcastStreamStatus(req.authUserId, formatStreamStatus(session));
      }
      
      res.json({
        ok: true,
        hasActiveStream: streamInfo.hasActiveStream,
        streamInfo: streamInfo.streamInfo
      });
    } catch (err: any) {
      res.status(400).json({ ok: false, error: String(err?.message ?? err) });
    }
  });
}

/**
 * JSON payload that describes the current stream status for the control panel.
 */
export type StreamStatusPayload = {
  streamType: 'unmanaged' | null;
  streamStatus?: string;
  streamId?: string | null;
  directRtmpUrl?: string | null;
  error?: string | null;
  glassesBatteryPercent?: number | null;
  hasActiveSession?: boolean;
};

/**
 * Builds a serializable status payload from an AppSession.
 */
export function formatStreamStatus(session?: AppSession): StreamStatusPayload {
  return {
    streamType: session?.streamType === 'unmanaged' ? 'unmanaged' : null,
    streamStatus: session?.streamStatus,
    streamId: session?.streamId ?? null,
    directRtmpUrl: session?.directRtmpUrl ?? null,
    error: session?.error ?? null,
    glassesBatteryPercent: session?.glassesBatteryPercent ?? null,
    hasActiveSession: !!session,
  };
}

/**
 * Broadcasts a status update to all active SSE clients for a user.
 */
export function broadcastStreamStatus(userId: string, status: StreamStatusPayload): void {
  const clients = sseClientsByUser.get(userId);
  if (!clients || clients.size === 0) return;
  for (const res of clients) {
    writeSseEvent(res, 'status', status);
  }
}

/**
 * Writes a single SSE event to the given response.
 */
function writeSseEvent(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

// In-memory registry of SSE clients keyed by userId
const sseClientsByUser = new Map<string, Set<Response>>();
