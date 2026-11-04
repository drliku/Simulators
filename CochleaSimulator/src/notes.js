// MIDI note number -> frequency in Hz (A4 = 69 = 440 Hz)
export const midiFreq = (m) => 440 * 2 ** ((m - 69) / 12);
