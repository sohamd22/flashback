import { AppSession } from "@mentra/sdk";

declare module "@mentra/sdk" {
    interface AppSession {
        streamType: 'unmanaged' | null;
        streamStatus: string;
        streamId: string | null;
        directRtmpUrl: string | null;
        error: string | null;
        glassesBatteryPercent: number | null;
        
        // Persist user configuration
        customRtmpUrl: string | null;
    }
}