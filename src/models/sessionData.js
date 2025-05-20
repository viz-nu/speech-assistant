import mongoose from 'mongoose';
const TranscriptSchema = new mongoose.Schema({
    speaker: String, // 'user' or 'assistant'
    message: String,
    timestamp: { type: Date, default: Date.now }
});

const CallSessionSchema = new mongoose.Schema({
    callSessionId: { type: String },
    phoneNumber: String,
    voice: String,
    systemMessage: String,
    outboundTwiML: String,
    transcripts: [TranscriptSchema],
    misc: Object,
    createdAt: { type: Date, default: Date.now }
});

export const CallSession = mongoose.model('CallSession', CallSessionSchema);