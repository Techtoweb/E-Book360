// Real-time Sound & Browser Notification Helper for Admin
import { Order } from '../types';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        audioCtx = new AudioCtxClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Play a crystal-clear, melodic "Cashier Bell / New Order" chime
 */
export function playNewOrderSound(volume: number = 0.8) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(Math.max(0.05, Math.min(1, volume)), now);
    masterGain.connect(ctx.destination);

    // Note 1: E6 (1318.5 Hz) - bright chime
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1318.51, now);
    gain1.gain.setValueAtTime(0.6, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc1.connect(gain1);
    gain1.connect(masterGain);
    osc1.start(now);
    osc1.stop(now + 0.6);

    // Note 2: G#6 (1661.2 Hz) - pleasant harmony
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1661.22, now + 0.12);
    gain2.gain.setValueAtTime(0.001, now);
    gain2.gain.setValueAtTime(0.7, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
    osc2.connect(gain2);
    gain2.connect(masterGain);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.9);

    // Note 3: B6 (1975.5 Hz) - high triumph note (Cash Register feeling)
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(1975.53, now + 0.25);
    gain3.gain.setValueAtTime(0.001, now);
    gain3.gain.setValueAtTime(0.8, now + 0.25);
    gain3.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
    osc3.connect(gain3);
    gain3.connect(masterGain);
    osc3.start(now + 0.25);
    osc3.stop(now + 1.25);
  } catch (err) {
    console.warn('Could not play order sound:', err);
  }
}

/**
 * Play a shorter soft confirmation chime
 */
export function playSuccessChime() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    gain.connect(ctx.destination);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1760, now + 0.25);
    osc.connect(gain);
    osc.start(now);
    osc.stop(now + 0.4);
  } catch {
    // ignore
  }
}

/**
 * Request Desktop / Browser Notification permission
 */
export async function requestBrowserNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    return 'denied';
  }
  try {
    const perm = await Notification.requestPermission();
    return perm;
  } catch {
    return 'denied';
  }
}

/**
 * Send native browser notification for new orders
 */
export function showOrderDesktopNotification(order: Order, onClick?: () => void) {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  try {
    const title = `🔔 নতুন অর্ডার এসেছে! (#${order.orderNumber || order.id.slice(-6)})`;
    const options: NotificationOptions = {
      body: `গ্রাহক: ${order.customerName} | পরিমাণ: ৳${order.amount}\nপেমেন্ট: ${order.gateway.toUpperCase()} • TrxID: ${order.trxId}`,
      icon: '/favicon.ico',
      tag: `order-${order.id}`,
      requireInteraction: true, // keeps notification on screen until user interacts
    };

    const notif = new Notification(title, options);
    notif.onclick = () => {
      window.focus();
      if (onClick) onClick();
      notif.close();
    };
  } catch (err) {
    console.warn('Desktop notification error:', err);
  }
}
