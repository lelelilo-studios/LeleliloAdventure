// Lelelilo's Adventure: the sound, on the browser's audio thread. The synthesizer is a small WebAssembly module of
// its own (audio.wasm, with no imports); the game sends it commands as bytes through the port.
class LeleliloAudio extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.queue = [];
    this.port.onmessage = e => { if (this.w) this.send(e.data); else this.queue.push(e.data); };
    try {
      // Compiling here, off the page's main thread, is allowed synchronously
      const module = new WebAssembly.Module(options.processorOptions.wasm);
      this.w = new WebAssembly.Instance(module, {}).exports;
      this.w.init(sampleRate);
      for (const b of this.queue) this.send(b);
      this.queue = null;
    } catch (e) {
      this.port.postMessage({ error: String(e) });
    }
  }
  send(buffer) {
    const bytes = new Uint8Array(buffer), p = this.w.inbox(bytes.length);
    new Uint8Array(this.w.memory.buffer, p, bytes.length).set(bytes);
    this.w.commands(bytes.length);
  }
  process(_, outputs) {
    const out = outputs[0];
    if (!this.w || !out || !out.length) return true;
    const n = out[0].length, p = this.w.render(n), memory = this.w.memory.buffer;
    // (the views onto the synthesizer's two channels are kept: made anew only when its memory moves or grows, so
    // the audio thread makes no garbage)
    if (this.memory !== memory || this.at !== p || this.n !== n) {
      [this.memory, this.at, this.n] = [memory, p, n];
      this.left = new Float32Array(memory, p, n);
      this.right = new Float32Array(memory, p + n * 4, n);
    }
    out[0].set(this.left);
    if (out[1]) out[1].set(this.right);
    return true;
  }
}
registerProcessor('lelelilo-audio', LeleliloAudio);
