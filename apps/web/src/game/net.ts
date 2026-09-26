import {
  REFUSED_CLOSE_CODE,
  REPLACED_CLOSE_CODE,
  SENT_HOME_CLOSE_CODE,
  type ClientMessage,
  type ServerMessage,
} from '@explore/core';

export type Connection = { send: (message: ClientMessage) => void; close: () => void };

export type ConnectionStatus = 'open' | 'reconnecting' | 'replaced' | 'refused' | 'sentHome';

/** Close codes after which the client does not reconnect. */
const ENDINGS: Record<number, ConnectionStatus | undefined> = {
  [REPLACED_CLOSE_CODE]: 'replaced',
  [REFUSED_CLOSE_CODE]: 'refused',
  [SENT_HOME_CLOSE_CODE]: 'sentHome',
};

type Handlers = {
  worldId: number;
  onMessage: (message: ServerMessage) => void;
  onStatus: (status: ConnectionStatus) => void;
};

/** One game socket into `worldId` that reconnects with backoff until closed, replaced, refused, or sent home. */
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
      const ended = ENDINGS[event.code];
      if (ended) {
        closed = true;
        onStatus(ended);
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
