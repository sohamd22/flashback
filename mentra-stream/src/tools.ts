import type { ToolCall, AppSession } from '@mentra/sdk';
import { broadcastStreamStatus, formatStreamStatus } from './webview';

/**
 * Handle a tool call
 * @param toolCall - The tool call from the server
 * @param userId - The user ID of the user who called the tool
 * @param session - The session object if the user has an active session
 * @returns A promise that resolves to the tool call result
 */
export async function handleToolCall(toolCall: ToolCall, userId: string, session: AppSession|undefined): Promise<string | undefined> {
  console.log(`Tool called: ${toolCall.toolId}`);
  console.log(`Tool call timestamp: ${toolCall.timestamp}`);
  console.log(`Tool call userId: ${toolCall.userId}`);
  if (toolCall.toolParameters && Object.keys(toolCall.toolParameters).length > 0) {
    console.log("Tool call parameter values:", toolCall.toolParameters);
  }

  if (toolCall.toolId === "start_streaming") {
    if (!session) {
      return "Error: No active session";
    }

    try {
      // Get RTMP URL parameter
      const rtmpUrl = (toolCall.toolParameters?.rtmpUrl as string) || session.customRtmpUrl || '';

      if (!rtmpUrl) {
        return "Error: Missing RTMP URL";
      }

      // Save configuration
      session.customRtmpUrl = rtmpUrl;

      // Start unmanaged RTMP stream
      session.camera.startStream({ rtmpUrl }).then(() => {
        broadcastStreamStatus(userId, formatStreamStatus(session));
      });
      return "Stream started successfully";
    } catch (error: any) {
      console.error("Error starting stream:", error);
      return `Error: ${error?.message || error}`;
    }
  } else if (toolCall.toolId === "stop_streaming") {
    if (!session) {
      return "Error: No active session";
    }

    try {
      if (session.streamType === 'unmanaged') {
        session.camera.stopStream().then(() => {
          broadcastStreamStatus(userId, formatStreamStatus(session));
        });
        return "Stream stopped successfully";
      } else {
        return "No active stream to stop";
      }
    } catch (error: any) {
      console.error("Error stopping stream:", error);
      return `Error: ${error?.message || error}`;
    }
  }

  return undefined;
}