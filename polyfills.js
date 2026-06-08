// Polyfills necessários para livekit-client rodar no Hermes (React Native).
// Hermes não expõe DOMException globalmente, e o livekit-client usa para
// sinalizar erros de conexão.
if (typeof globalThis.DOMException === 'undefined') {
  class DOMException extends Error {
    constructor(message = '', name = 'Error') {
      super(message);
      this.name = name;
    }
  }
  globalThis.DOMException = DOMException;
}
