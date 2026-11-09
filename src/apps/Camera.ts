import type { AppDefinition } from '../core/types';
import { VFS } from '../core/VFS';
import { cameraIcon } from '../ui/icons';

export const CameraApp: AppDefinition = {
  id: 'camera',
  name: 'Camera',
  icon: cameraIcon,
  defaultSize: { width: 720, height: 520 },
  render() {
    const root = document.createElement('div');
    root.className = 'camera-app';
    root.innerHTML = `
      <div class="cam-stage">
        <video class="cam-video" data-k="video" autoplay playsinline muted></video>
        <canvas class="cam-canvas" data-k="canvas"></canvas>
        <div class="cam-overlay" data-k="overlay">
          <div class="cam-corner tl"></div><div class="cam-corner tr"></div>
          <div class="cam-corner bl"></div><div class="cam-corner br"></div>
        </div>
        <div class="cam-flash" data-k="flash"></div>
        <div class="cam-status" data-k="status">Starting camera…</div>
      </div>
      <div class="cam-bar">
        <button type="button" class="cam-btn cam-btn-ghost" data-a="flip" title="Switch camera" aria-label="Switch camera">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7h-7a4 4 0 1 0 0 8h1"/><path d="m17 4 3 3-3 3"/><path d="M4 17h7a4 4 0 1 0 0-8h-1"/><path d="m7 20-3-3 3-3"/></svg>
        </button>
        <button type="button" class="cam-shutter" data-a="shot" aria-label="Take photo"><span></span></button>
        <div class="cam-last" data-k="last" title="Last capture"></div>
      </div>
      <div class="cam-toast" data-k="toast" aria-live="polite"></div>`;

    const video = root.querySelector('[data-k="video"]') as HTMLVideoElement;
    const canvas = root.querySelector('[data-k="canvas"]') as HTMLCanvasElement;
    const status = root.querySelector('[data-k="status"]') as HTMLElement;
    const flash = root.querySelector('[data-k="flash"]') as HTMLElement;
    const last = root.querySelector('[data-k="last"]') as HTMLElement;
    const toast = root.querySelector('[data-k="toast"]') as HTMLElement;
    let stream: MediaStream | null = null;
    let facing: 'user' | 'environment' = 'user';

    const say = (msg: string, ms = 2200) => { toast.textContent = msg; toast.classList.add('show'); window.setTimeout(() => toast.classList.remove('show'), ms); };
    const setStatus = (msg: string, isErr = false) => { status.textContent = msg; status.classList.toggle('is-err', isErr); status.style.display = msg ? '' : 'none'; };
    const stop = () => { stream?.getTracks().forEach(t => t.stop()); stream = null; };

    const start = async () => {
      stop();
      setStatus('Starting camera…');
      if (!navigator.mediaDevices?.getUserMedia) { setStatus('Camera not available in this browser.', true); return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false });
        video.srcObject = stream;
        await video.play().catch(() => {});
        setStatus('');
      } catch (e: any) {
        const msg = e?.name === 'NotAllowedError' ? 'Camera permission denied.' : (e?.name === 'NotFoundError' ? 'No camera found.' : 'Could not start camera.');
        setStatus(msg, true);
      }
    };

    const ensurePictures = () => { try { VFS.getNode('Pictures') || VFS.createFolder('', 'Pictures'); } catch {} };

    root.addEventListener('click', async (e) => {
      const a = (e.target as HTMLElement).closest('[data-a]') as HTMLElement | null;
      if (a?.dataset.a === 'flip') { facing = facing === 'user' ? 'environment' : 'user'; start(); return; }
      if (a?.dataset.a === 'shot') {
        if (!stream || !video.videoWidth) { say('Camera not ready'); return; }
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(video, 0, 0);
        flash.classList.add('fire'); window.setTimeout(() => flash.classList.remove('fire'), 180);
        const data = canvas.toDataURL('image/jpeg', 0.92);
        last.style.backgroundImage = `url("${data}")`; last.classList.add('has');
        ensurePictures();
        const name = `Photo-${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`;
        try { VFS.createFile('Pictures', name, data); say('Saved to Pictures'); } catch { try { VFS.writeFile(`Pictures/${name}`, data); say('Saved to Pictures'); } catch { say('Saved to preview only'); } }
      }
    });

    const obs = new MutationObserver(() => { if (!root.isConnected) { stop(); obs.disconnect(); } });
    obs.observe(document.body, { childList: true, subtree: true });
    start();
    return root;
  },
};
