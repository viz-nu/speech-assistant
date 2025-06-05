/**
 * Linear interpolation PCM resampling (mono, 16-bit LE).
 * Works for upsampling or downsampling.
 * @param {Buffer} inputBuffer - PCM buffer (16-bit LE mono)
 * @param {number} fromRate - Original sample rate (e.g., 8000)
 * @param {number} toRate - Target sample rate (e.g., 24000)
 * @returns {Buffer} - Resampled PCM buffer (16-bit LE mono)
 */
export function resamplePCM(inputBuffer, fromRate, toRate) {
    if (fromRate === toRate) return inputBuffer;
    const input = new Int16Array(inputBuffer.buffer, inputBuffer.byteOffset, inputBuffer.byteLength / 2);
    const ratio = toRate / fromRate;
    const outputLength = Math.floor(input.length * ratio);
    const output = new Int16Array(outputLength);
    for (let i = 0; i < outputLength; i++) {
        const pos = i / ratio;
        const i1 = Math.floor(pos);
        const i2 = Math.min(i1 + 1, input.length - 1);
        const weight = pos - i1;
        output[i] = (1 - weight) * input[i1] + weight * input[i2];
    }
    return Buffer.from(output.buffer);
}
