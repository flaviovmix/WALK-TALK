// IP da LAN do PC rodando o backend e o LiveKit.
// O celular precisa conseguir enxergar esse IP — estar na mesma rede Wi-Fi.
// Se mudar de rede, atualizar aqui.
const LAN_IP = '192.168.1.50';

export const BACKEND_URL = `http://${LAN_IP}:3001`;
export const LIVEKIT_URL = `ws://${LAN_IP}:7880`;
