// Embedded YouTube player (official IFrame API). The simulator hears it by sharing this tab's sound.

let apiPromise = null;
function loadApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  apiPromise ??= new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT);
    };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => {
      apiPromise = null;
      reject(new Error('Could not load YouTube. Check your internet connection.'));
    };
    document.head.appendChild(s);
  });
  return apiPromise;
}

// Accepts watch, youtu.be, shorts, live, embed and music.youtube.com links, or a bare video id.
export function parseYouTubeId(text) {
  const raw = text.trim();
  if (/^[\w-]{11}$/.test(raw)) return raw;
  let url;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|music)\./, '');
  let id = null;
  if (host === 'youtu.be') id = url.pathname.split('/')[1];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id = url.searchParams.get('v') || url.pathname.match(/^\/(?:shorts|embed|live|v)\/([\w-]{11})/)?.[1];
  }
  return id && /^[\w-]{11}$/.test(id) ? id : null;
}

const ERRORS = {
  2: 'That YouTube link is not valid.',
  5: 'YouTube could not play this video here.',
  100: 'That video was not found, or it is private.',
  101: "The video's owner doesn't allow it to play on other sites. Try another video.",
  150: "The video's owner doesn't allow it to play on other sites. Try another video.",
};

export class YouTubePlayer {
  constructor(mount, { onError, onState } = {}) {
    this.mount = mount;
    this.onError = onError;
    this.onState = onState;
    this.player = null;
    this.ready = null;
  }

  async play(videoId) {
    const YT = await loadApi();
    if (this.player) {
      await this.ready;
      this.player.loadVideoById(videoId);
      return;
    }
    const host = document.createElement('div');
    this.mount.replaceChildren(host);
    this.ready = new Promise((resolve) => {
      this.player = new YT.Player(host, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: { autoplay: 1, playsinline: 1, rel: 0 },
        events: {
          onReady: (e) => { e.target.playVideo(); resolve(); },
          onError: (e) => this.onError?.(new Error(ERRORS[e.data] || 'YouTube could not play this video.')),
          onStateChange: (e) => this.onState?.(e.data),
        },
      });
    });
  }

  pause() {
    this.player?.pauseVideo?.();
  }

  close() {
    this.player?.destroy?.();
    this.player = null;
    this.ready = null;
    this.mount.replaceChildren();
  }
}
