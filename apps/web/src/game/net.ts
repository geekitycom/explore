import {
  REFUSED_CLOSE_CODE,
  REPLACED_CLOSE_CODE,
  type ClientMessage,
  type ServerMessage,
} from '@explore/core';

export type Connection = { send: (message: ClientMessage) => void; close: () => void };

export type ConnectionStatus = 'open' | 'reconnecting' | 'replaced' | 'refused';

type Handlers = {
  worldId: number;
  onMessage: (message: ServerMessage) => void;
  onStatus: (status: ConnectionStatus) => void;
};

/** One game socket into `worldId` that reconnects with backoff until closed, replaced, or refused. */
export function connect({ worldId, onMessage, onStatus }: Handlers): Connection {
  const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/worlds/${worldId}`;
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
      if (event.code === REPLACED_CLOSE_CODE || event.code === REFUSED_CLOSE_CODE) {
        closed = true;
        onStatus(event.code === REPLACED_CLOSE_CODE ? 'replaced' : 'refused');
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
