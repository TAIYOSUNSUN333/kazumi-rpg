// Original looping scores. Notes are MIDI pitches; each measure has eight steps.
const scores = {
  loss: [45, 'piano', [45, 41, 38, 40], [69, null, 64, null, 62, null, 57, null]],
  title: [102, 'strings', [50, 46, 53, 48], [62, 69, 74, 77, 76, 74, 69, 65]],
  home: [78, 'piano', [48, 45, 41, 43], [60, 64, 67, 72, 67, 64, 62, 64]],
  field: [118, 'flute', [50, 53, 55, 48], [62, 65, 69, 74, 72, 69, 65, 67]],
  village: [92, 'piano', [53, 48, 50, 46], [65, 69, 72, 69, 67, 65, 62, 64]],
  dungeon: [74, 'strings', [45, 46, 42, 44], [57, null, 58, null, 63, 61, null, 56]],
  battle: [156, 'flute', [45, 48, 43, 46], [69, 72, 76, 72, 74, 77, 76, 74]],
  genesis: [136, 'strings', [38, 46, 41, 48], [74, 81, 86, 89, 86, 84, 81, 77]],
  boss: [128, 'strings', [38, 37, 41, 34], [62, 69, 65, 63, 62, 70, 67, 65]]
};
const effects = {
  seal: [55, 60, 64, 67, 72, 79],
  jump: [55, 62], air: [74, 62, 55], magic: [67, 74, 81], pot: [48, 58, 44],
  attack: [59, 48], hit: [43, 38], victory: [60, 64, 67, 72],
  awake1: [67, 74, 79], awake2: [57, 65, 72, 81], awake3: [72, 78, 85],
  awake4: [64, 76, 83, 88], awake5: [48, 60, 67, 72, 79, 84],
  holy: [72, 76, 84], creation: [48, 55, 60, 67, 72, 79, 84, 91],
  level: [60, 67, 72, 76, 79], encounter: [48, 55, 61], special: [60, 67, 72, 79, 84]
};

class GameAudio {
  constructor() {
    this.volume = .45;
    this.muted = false;
    this.track = 'title';
    this.step = 0;
  }

  unlock() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.connect(this.context.destination);
      this.music = this.context.createGain();
      this.music.connect(this.master);
      this.setVolume(this.volume, this.muted);
      this.next = this.context.currentTime;
      this.timer = setInterval(() => this.schedule(), 30);
    }
    if (this.context.state !== 'running') this.context.resume().catch(() => {});
  }

  setVolume(volume, muted) {
    this.volume = volume;
    this.muted = muted;
    this.master?.gain.setTargetAtTime(muted ? 0 : volume, this.context.currentTime, .025);
  }

  setTrack(track) {
    if (this.track === track) return;
    this.track = track;
    this.step = 0;
    if (!this.context) return;
    const now = this.context.currentTime;
    const previous = this.music;
    previous.gain.setTargetAtTime(0, now, .02);
    setTimeout(() => previous.disconnect(), 200);
    this.music = this.context.createGain();
    this.music.connect(this.master);
    this.next = now + .05;
  }

  note(pitch, at, length, volume, voice, output) {
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = voice === 'strings' ? 'triangle' : 'sine';
    oscillator.frequency.value = 440 * 2 ** ((pitch - 69) / 12);
    envelope.gain.setValueAtTime(.001, at);
    envelope.gain.exponentialRampToValueAtTime(volume, at + .025);
    envelope.gain.exponentialRampToValueAtTime(.001, at + length);
    oscillator.connect(envelope);
    envelope.connect(output);
    oscillator.onended = () => envelope.disconnect();
    oscillator.start(at);
    oscillator.stop(at + length);
  }

  schedule() {
    if (this.context.state !== 'running') return;
    const now = this.context.currentTime;
    const [bpm, voice, roots, melody] = scores[this.track];
    const beat = 30 / bpm;
    if (this.next < now) this.next = now;
    while (this.next < now + .10) {
      const index = this.step % 8;
      const root = roots[Math.floor(this.step / 8)];
      const pitch = melody[index];
      if (pitch !== null) {
        this.note(pitch + (root - roots[0]), this.next, beat * 1.6, .12, voice, this.music);
      }
      if (index % 2 === 0) {
        const bass = root - (index % 4 ? 5 : 12);
        this.note(bass, this.next, beat * 2.1, .13, voice, this.music);
      }
      if (voice === 'strings' && index % 4 === 0) {
        this.note(root + 7, this.next, beat * 4, .07, voice, this.music);
        this.note(root + 12, this.next, beat * 4, .06, voice, this.music);
      }
      this.next += beat;
      this.step = (this.step + 1) % 32;
    }
  }

  play(effect) {
    if (this.context?.state !== 'running') return;
    effects[effect].forEach((pitch, i) =>
      this.note(pitch, this.context.currentTime + i * .078, .15, .18, 'strings', this.master));
  }
}

const audio = new GameAudio();
