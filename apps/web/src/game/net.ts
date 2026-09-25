import type { ClientMessage, ServerMessage } from '@explore/core';

const REPLACED_CLOSE_CODE = 4000;

export type Connection = { send: (message: ClientMessage) => void; close: () => void };

type Handlers = {
  onMessage: (message: ServerMessage) => void;
  onStatus: (status: 'open' | 'reconnecting' | 'replaced') => void;
};

/** One game socket that reconnects with backoff until closed or replaced by another tab. */
export function connect({ onMessage, onStatus }: Handlers): Connection {
  const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
  let socket: WebSocket | undefined;
  let closed = false;
  let attempt = 0;

  const open = () => {
    socket = new WebSocket(url);
    socket.addEventListener('open', () => {
      attempt = 0;
      onStatus('open');
    });
    socket.addEventListener('message', (event) => {
      onMessage(JSON.parse(String(event.data)) as ServerMessage);
    });
    socket.addEventListener('close', (event) => {
      if (closed) return;
      if (event.code === REPLACED_CLOSE_CODE) {
        closed = true;
        onStatus('replaced');
        return;
      }
      onStatus('reconnecting');
      window.setTimeout(open, Math.min(8000, 500 * 2 ** attempt++));
    });
  };
  open();

  return {
    send: (message) => {
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
    },
    close: () => {
      closed = true;
      socket?.close();
    },
  };
}
