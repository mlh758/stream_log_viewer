import React, { useState, useEffect } from "react";
import { Container } from "@material-ui/core";
import { Alert, AlertTitle } from "@material-ui/lab";
import LogList from "./LogList";

interface Props {
  streamName: string;
  limit: number;
}

const LogTailer: React.FC<Props> = ({ streamName, limit }) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    const protocol = window.location.protocol.includes("https") ? "wss" : "ws";
    const host = window.location.host;
    const socket = new WebSocket(
      `${protocol}://${host}/api/tail/${streamName}`
    );
    socket.addEventListener("message", (event) => {
      setLogs((l) => {
        let newLogs = l.concat(JSON.parse(event.data));
        return newLogs.slice(Math.max(l.length - limit, 0));
      });
    });
    socket.addEventListener("error", (_event) => {
      setError(true);
    });
    socket.addEventListener("close", (_event) => {
      setError(true); // we don't expect the server to terminate this connection
    });
    return () => socket.close();
  }, [streamName, limit]);
  return (
    <Container maxWidth="lg">
      {error && (
        <Alert severity="error" onClose={() => setError(false)}>
          <AlertTitle>Tailing stopped</AlertTitle>
          The server closed the connection unexpectedly.
        </Alert>
      )}
      <LogList logs={logs} />
    </Container>
  );
};

export default LogTailer;
