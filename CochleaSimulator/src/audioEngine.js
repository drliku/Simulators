// Web Audio input: an imported file (played back + analysed) or the microphone (analysed only).
// Every source (and the instrument you play) feeds `inputBus`, which drives the analyser.
export const FFT_SIZE = 8192; // same window length as the Blender bake

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.analyser = null;
    this.element = new Audio();
    this.element.preload = 'auto';
    this.elementSource = null;
    this.micSource = null;
    this.micStream = null;
    this.gain = null;
    this.mode = 'none'; // 'file' | 'mic' | 'tab' | 'none'
    this.fileName = '';
    this._db = null;
    this._objectUrl = null;
  }

  _ensure() {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = FFT_SIZE;
    this.analyser.smoothingTimeConstant = 0;
    this.analyser.minDecibels = -160;
    this.analyser.maxDecibels = 0;
    this.inputBus = this.ctx.createGain();
    this.inputBus.connect(this.analyser);
    this.gain = this.ctx.createGain();
    this.gain.connect(this.ctx.destination);
    this.elementSource = this.ctx.createMediaElementSource(this.element);
    this.elementSource.connect(this.gain);
    this._db = new Float32Array(this.analyser.frequencyBinCount);
    this.manualUntil = 0; // notes you play on an instrument keep the analysis running
  }

  // AudioContext for other modules (the instrument synth); created on first use.
  context() {
    this._ensure();
    return this.ctx;
  }

  get sampleRate() {
    return this.ctx ? this.ctx.sampleRate : 48000;
  }

  async loadFile(file) {
    this._ensure();
    this.stopLive();
    if (this._objectUrl) URL.revokeObjectURL(this._objectUrl);
    this._objectUrl = URL.createObjectURL(file);
    return this._loadUrl(this._objectUrl, file.name);
  }

  async loadUrl(url, name) {
    this._ensure();
    this.stopLive();
    return this._loadUrl(url, name);
  }

  async _loadUrl(url, name) {
    this.element.src = url;
    this.fileName = name;
    this.elementSource.disconnect();
    this.elementSource.connect(this.gain);
    this.elementSource.connect(this.inputBus);
    this.mode = 'file';
    await new Promise((resolve, reject) => {
      const ok = () => { cleanup(); resolve(); };
      const fail = () => { cleanup(); reject(new Error('This file could not be decoded by the browser.')); };
      const cleanup = () => {
        this.element.removeEventListener('loadedmetadata', ok);
        this.element.removeEventListener('error', fail);
      };
      this.element.addEventListener('loadedmetadata', ok);
      this.element.addEventListener('error', fail);
    });
    await this.play();
  }

  async startMic() {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    await this._startLive(stream, 'mic', 'Microphone');
  }

  // Listen to a browser tab through the screen-share picker: another tab, or this one
  // (`currentTab`, used for the embedded YouTube player). The tab keeps playing its own sound;
  // we only analyse it. Must be called straight from a click.
  async startTab({ currentTab = false } = {}) {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      throw new Error('This browser cannot share tab sound. Try Chrome or Edge on a computer.');
    }
    // Another tab: ask the browser to silence it on the speakers and play its sound through here
    // instead, so the volume slider controls it.
    const controller = !currentTab && 'CaptureController' in window ? new CaptureController() : undefined;
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true, // required by browsers; the picture is ignored
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, suppressLocalAudioPlayback: !currentTab },
      preferCurrentTab: currentTab,
      selfBrowserSurface: currentTab ? 'include' : 'exclude',
      systemAudio: 'include',
      ...(controller ? { controller } : {}),
    });
    try { controller?.setFocusBehavior('no-focus-change'); } catch { /* older browsers switch to the shared tab */ }
    const track = stream.getAudioTracks()[0];
    if (!track) {
      stream.getTracks().forEach((t) => t.stop());
      throw new Error(currentTab
        ? 'No sound was shared. Click "Connect sound" and turn on "Also share tab audio".'
        : 'No sound was shared. Pick a tab and turn on "Also share tab audio".');
    }
    const silenced = !currentTab && track.getSettings().suppressLocalAudioPlayback === true;
    await this._startLive(stream, 'tab', currentTab ? 'YouTube' : 'Browser tab', { route: silenced });
  }

  // route: play the live sound through this page (only when its own playback was silenced)
  async _startLive(stream, mode, label, { route = false } = {}) {
    this._ensure();
    this.stopLive();
    this.element.pause();
    this.elementSource.disconnect();
    this.elementSource.connect(this.gain);
    this.micStream = stream;
    this.micSource = this.ctx.createMediaStreamSource(stream);
    this.micSource.connect(this.inputBus);
    // to the speakers only when the source isn't already audible by itself (never the mic: feedback)
    if (route) this.micSource.connect(this.gain);
    this.routeLive = route;
    this.mode = mode;
    this.fileName = label;
    stream.getAudioTracks()[0].addEventListener('ended', () => {
      if (this.micStream === stream) this.stopLive();
      this.onLiveEnded?.();
    });
    await this.ctx.resume();
  }

  stopLive() {
    if (this.micSource) this.micSource.disconnect();
    if (this.micStream) this.micStream.getTracks().forEach((t) => t.stop());
    this.micSource = null;
    this.micStream = null;
    this.routeLive = false;
    if (this.mode === 'mic' || this.mode === 'tab') this.mode = 'none';
  }

  async play() {
    if (this.mode !== 'file') return;
    await this.ctx.resume();
    await this.element.play();
  }

  pause() {
    this.element.pause();
  }

  get playing() {
    return this.mode === 'mic' || this.mode === 'tab' || (this.mode === 'file' && !this.element.paused);
  }

  setVolume(v) {
    if (this.gain) this.gain.gain.value = v;
  }

  get listening() {
    return this.playing || (this.ctx && this.ctx.currentTime < this.manualUntil);
  }

  // Fill `out` with linear power per FFT bin; zeros when there is no live input.
  readPower(out) {
    if (!this.analyser || !this.listening) {
      out.fill(0);
      return;
    }
    const db = this._db;
    this.analyser.getFloatFrequencyData(db);
    for (let k = 0; k < out.length; k++) {
      const d = db[k];
      out[k] = d > -159 ? 10 ** (d / 10) : 0;
    }
  }
}
