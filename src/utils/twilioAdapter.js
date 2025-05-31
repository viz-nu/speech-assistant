import { TelephonyAdapter } from "../services/baseMediaStreamHandler";

export class TwilioAdapter extends TelephonyAdapter {
    handleIncomingMessage(message) {
        let data;
        try {
            data = JSON.parse(message);
        } catch (err) {
            console.error(`[${this.callSessionId}] Invalid JSON:`, message);
            return;
        }

        switch (data.event) {
            case 'start':
                this.streamSid = data.start.streamSid;
                console.log(`[${this.callSessionId}] Twilio stream started: ${this.streamSid}`);
                this.onStart && this.onStart(data.start);
                break;

            case 'media':
                if (data.media?.payload) {
                    this.onMedia && this.onMedia(data.media.payload);
                }
                break;

            case 'stop':
                console.log(`[${this.callSessionId}] Twilio stream stopped`);
                this.onStop && this.onStop();
                break;

            default:
                console.log(`[${this.callSessionId}] Unhandled Twilio event:`, data.event);
        }
    }

    sendMedia(base64Audio) {
        if (!this.isConnected()) return;
        const payload = {
            event: 'media',
            streamSid: this.streamSid,
            media: { payload: base64Audio }
        };
        this._send(payload);
    }

    sendMark(mark) {
        if (!this.isConnected()) return;
        this._send({ event: 'mark', streamSid: this.streamSid, mark: { name: mark } });
    }

    sendClear() {
        if (!this.isConnected()) return;
        this._send({ event: 'clear', streamSid: this.streamSid });
    }

    sendStop() {
        if (!this.isConnected()) return;
        this._send({ event: 'stop', streamSid: this.streamSid });
    }
}
