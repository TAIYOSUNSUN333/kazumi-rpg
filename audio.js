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
  midboss: [134, 'horn', [38, 36, 41, 43], [62, 65, 69, 68, null, 65, 62, 60]],
  boss: [128, 'trumpet', [38, 37, 41, 34], [62, 69, 65, 63, 62, 70, 67, 65]],
  emperor0: [148,'trombone',[36,39,34,31],[60,67,72,70,67,66,63,60]],
  emperor1: [104,'oboe',[45,42,38,40],[69,73,76,78,76,71,69,67]],
  emperor2: [162,'trumpet',[47,43,45,42],[71,74,83,81,78,74,76,78]],
  emperor3: [106,'organ',[34,29,31,33],[58,null,63,61,67,61,59,58]],
  innEntry: [90,'guitar',[48,45,41,43],[60,64,67,72,69,67,64,62]],
  innDesk: [80,'piano',[52,48,45,43],[64,67,71,null,72,69,67,64]],
  innTalk: [72,'harp',[48,52,45,41],[67,72,76,74,72,69,67,null]],
  innSleep: [60,'musicbox',[48,45,41,43],[72,null,76,null,74,null,67,null]],
  innWake: [86,'piano',[48,53,45,43],[60,67,72,76,79,76,74,72]]
};
const townMelodies = [
  [65,69,72,74,72,69,67,65], [67,71,76,74,71,67,64,66], [62,66,69,76,74,69,66,64],
  [60,63,67,72,67,65,63,62], [64,67,72,79,76,74,72,67], [65,68,72,77,75,72,68,65],
  [58,62,65,69,65,62,60,58], [61,65,68,73,71,68,65,63], [69,72,76,79,76,72,71,69],
  [67,70,74,79,77,74,70,67], [64,69,73,76,73,71,69,64], [62,65,69,74,72,69,65,62]
];
townMelodies.forEach((melody, index) => {
  const root = melody[0] - 17;
  scores['town' + index] = [76 + index * 3, index % 3 === 1 ? 'flute' : 'piano',
    [root, root + 5, root - 2, root + 2], melody];
});
for (let index = townMelodies.length; index < prefectures.length; index++) {
  const source = townMelodies[index % townMelodies.length];
  const shift = Math.floor(index / townMelodies.length) - 2;
  const melody = source.map((note, i) => note + shift + (i === 2 ? index % 4 : 0));
  const root = melody[0] - 17;
  scores['town' + index] = [76 + index % 12 * 3, index % 3 === 1 ? 'flute' : 'piano',
    [root, root + 5, root - 2, root + 2], melody];
}
const effects = {
  quake:[35,29],
  seal: [55, 60, 64, 67, 72, 79],
  jump: [55, 62], air: [74, 62, 55], magic: [67, 74, 81], pot: [48, 58, 44],
  attack: [59, 48], hit: [43, 38], victory: [60, 64, 67, 72],
  awake1: [67, 74, 79], awake2: [57, 65, 72, 81], awake3: [72, 78, 85],
  awake4: [64, 76, 83, 88], awake5: [48, 60, 67, 72, 79, 84],
  holy: [72, 76, 84], creation: [48, 55, 60, 67, 72, 79, 84, 91],
  level: [60, 67, 72, 76, 79], encounter: [48, 55, 61], special: [60, 67, 72, 79, 84]
};

// Harmonic weights, attack and spectral tail for synthesized orchestral timbres.
const instruments = {
  violin:[[1,.42,.28,.12,.13,.08],.045,.72],
  viola:[[1,.34,.21,.19,.08],.06,.67],
  cello:[[1,.62,.36,.16,.09],.055,.85],
  trumpet:[[1,.76,.44,.37,.24,.16,.15],.035,.72],
  horn:[[1,.55,.35,.16,.08],.06,.70],
  trombone:[[1,.77,.48,.27,.16],.055,.78],
  flute:[[1,.11,.04,.08],.05,.52],
  oboe:[[1,.66,.35,.12,.16,.08],.047,.58],
  piano:[[1,.36,.22,.15,.08,.05],.009,.27],
  guitar:[[1,.44,.12,.08,.17],.008,.19],
  harp:[[1,.27,.09,.15,.06],.007,.24],
  organ:[[1,.27,.47,.21,.14],.028,.84],
  choirHigh:[[1,.21,.55,.27,.04,.10],.10,.72],
  choirLow:[[1,.48,.39,.18,.09,.06],.12,.77],
  musicbox:[[1,.06,.06,.30,.025,.13],.006,.15],
  strings:[[1,.25,.12,.08],.02,.57]
};

class GameAudio {
  constructor() {
    this.volume = .45;
    this.musicVolume = .85;
    this.effectsVolume = .8;
    this.muted = false;
    this.track = 'title';
    this.step = 0;
  }

  unlock() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!this.context) {
      const context = this.context = new AudioContext();
      this.master = context.createGain();
      this.master.connect(context.destination);
      this.bgm = context.createGain();
      this.bgm.connect(this.master);
      this.sfx = context.createGain();
      this.sfx.connect(this.master);
      this.waves = {};
      for (const [name, [partials]] of Object.entries(instruments)) {
        this.waves[name] = context.createPeriodicWave(new Float32Array(partials.length + 1), new Float32Array([0,...partials]));
      }
      this.noise = context.createBuffer(1, Math.ceil(context.sampleRate * .48), context.sampleRate);
      const samples = this.noise.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
      this.music = context.createGain();
      this.music.connect(this.bgm);
      this.setVolume(this.volume, this.muted);
      this.setMix(this.musicVolume,this.effectsVolume);
      this.next = context.currentTime;
      this.timer = setInterval(() => this.schedule(), 40);
    }
    if (this.context.state !== 'running') this.context.resume().catch(() => {});
  }

  setVolume(volume, muted) {
    this.volume = volume;
    this.muted = muted;
    this.master?.gain.setTargetAtTime(muted ? 0 : volume, this.context.currentTime, .025);
  }

  setMix(music, effects) {
    this.musicVolume = music;
    this.effectsVolume = effects;
    const now = this.context?.currentTime;
    this.bgm?.gain.setTargetAtTime(music, now, .035);
    this.sfx?.gain.setTargetAtTime(effects, now, .035);
  }

  setTrack(track) {
    if (this.track === track || !scores[track]) return;
    this.track = track;
    this.step = 0;
    if (!this.context) return;
    const now = this.context.currentTime;
    const previous = this.music;
    if (previous.gain.cancelAndHoldAtTime) previous.gain.cancelAndHoldAtTime(now);
    else {
      const level = previous.gain.value;
      previous.gain.cancelScheduledValues(now);
      previous.gain.setValueAtTime(level,now);
    }
    previous.gain.setTargetAtTime(0, now, .13);
    setTimeout(() => previous.disconnect(), 1000);
    this.music = this.context.createGain();
    this.music.gain.setValueAtTime(0, now);
    this.music.gain.linearRampToValueAtTime(1, now + .42);
    this.music.connect(this.bgm);
    this.next = now + .025;
  }

  note(pitch, at, length, volume, voice, output, glide = 0) {
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    const [, attack, tail] = instruments[voice] || instruments.strings;
    oscillator.setPeriodicWave(this.waves[voice] || this.waves.strings);
    const hz = 440 * 2 ** ((pitch - 69) / 12);
    oscillator.frequency.setValueAtTime(hz, at);
    if (glide) oscillator.frequency.exponentialRampToValueAtTime(hz * glide, at + length * .7);
    const peak = at + Math.min(attack, length * .30);
    envelope.gain.setValueAtTime(.0001, at);
    envelope.gain.exponentialRampToValueAtTime(volume, peak);
    envelope.gain.exponentialRampToValueAtTime(volume * tail, at + length * .56);
    envelope.gain.exponentialRampToValueAtTime(.0001, at + length);
    oscillator.connect(envelope);
    envelope.connect(output);
    oscillator.onended = () => envelope.disconnect();
    oscillator.start(at);
    oscillator.stop(at + length);
  }

  percussion(kind, at) {
    const length = kind === 'cymbal' ? .40 : .24;
    if (kind !== 'cymbal') {
      this.note(kind === 'timpani' ? 40 : 31, at, length, .16, 'cello', this.music, .66);
    }
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const fade = this.context.createGain();
    source.buffer = this.noise;
    filter.type = kind === 'cymbal' ? 'highpass' : 'lowpass';
    filter.frequency.value = kind === 'cymbal' ? 4500 : 310;
    fade.gain.setValueAtTime(kind === 'cymbal' ? .07 : .13, at);
    fade.gain.exponentialRampToValueAtTime(.0001, at + length);
    source.connect(filter).connect(fade).connect(this.music);
    source.onended = () => { filter.disconnect(); fade.disconnect(); };
    source.start(at);
    source.stop(at + length);
  }

  schedule() {
    if (this.context.state !== 'running') return;
    const now = this.context.currentTime;
    const [bpm, voice, roots, melody] = scores[this.track];
    const beat = 30 / bpm;
    const track = this.track;
    const town = track.startsWith('town');
    const inn = track.startsWith('inn');
    const grand = ['title','boss','genesis'].includes(track) || track.startsWith('emperor');
    const combat = ['battle','midboss','boss','genesis'].includes(track) || track.startsWith('emperor');
    if (this.next < now) this.next = now;
    while (this.next < now + .12) {
      const at = this.next;
      const index = this.step % 8;
      const section = this.step >= 32 ? 1 : 0;
      const root = roots[Math.floor(this.step / 8) % roots.length];
      const pitch = melody[section && index >= 4 ? 11 - index : index];
      const line = pitch === null ? null : pitch + root - roots[0];
      if (line !== null) {
        const lead = town ? (Number(track.slice(4)) % 2 ? 'oboe' : 'guitar') :
          voice === 'strings' ? 'violin' : track === 'battle' ? 'violin' : voice;
        this.note(line, at, beat * (combat ? .90 : 1.75), .112, lead, this.music);
        if (grand && index % 2 === 0) this.note(line - 12, at, beat * 1.3, .046, 'viola', this.music);
      }
      if (index % 2 === 0) {
        const bass = root - (index % 4 ? 5 : 12);
        this.note(bass, at, beat * (combat ? 1.12 : 2.25), .081, inn ? 'piano' : 'cello', this.music);
      }
      if (index % 4 === 0) {
        this.note(root + 7, at, beat * 3.7, .052, grand ? 'horn' : inn ? 'guitar' : 'viola', this.music);
        this.note(root + 12, at, beat * 3.7, .034, grand ? 'organ' : 'flute', this.music);
      }
      if (grand && index === 0) {
        this.note(root + 12, at, beat * 7.6, .041, 'choirHigh', this.music);
        this.note(root + 3, at, beat * 7.2, .039, 'choirLow', this.music);
        this.note(root - 12, at, beat * 3.8, .058, 'trombone', this.music);
      }
      if (combat && [0,3,4,6].includes(index)) this.percussion(index === 0 ? 'drum' : index === 4 ? 'timpani' : 'cymbal', at);
      if (!combat && index % 2 === 1 && track !== 'innSleep') {
        this.note(root + [0,12,7,15][Math.floor(index / 2)], at, beat * 1.3, .047,
          town || inn ? 'guitar' : 'harp', this.music);
      }
      if (track === 'innWake' && index === 6) {
        this.note(95,at,.15,.039,'flute',this.music,1.24);
        this.note(98,at+.17,.11,.033,'flute',this.music,.87);
      }
      this.next += beat;
      this.step = (this.step + 1) % (grand || combat ? 64 : 32);
    }
  }

  play(effect) {
    if (this.context?.state !== 'running' || !effects[effect]) return;
    effects[effect].forEach((pitch, i) =>
      this.note(pitch, this.context.currentTime + i * .078, effect === 'quake' ? .26 : .15, .14, effect === 'quake' ? 'cello' : 'strings', this.sfx));
  }
}

const audio = new GameAudio();
