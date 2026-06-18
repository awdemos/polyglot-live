class PolyglotLiveCaptureProcessor extends AudioWorkletProcessor {
  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];

    if (input?.[0]) {
      this.port.postMessage(input[0].slice());
    }

    if (output?.[0]) {
      output[0].fill(0);
    }

    return true;
  }
}

registerProcessor("polyglot-live-capture-processor", PolyglotLiveCaptureProcessor);
