import React, { useState, useEffect } from "react";
import { Container } from "@material-ui/core";
import LogList from "./LogList";

interface Props {
  streamName: string;
  limit: number;
}

const LogTailer: React.FC<Props> = ({ streamName, limit }) => {
  let [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    const socket = new WebSocket(`ws://localhost:3000/api/tail/${streamName}`);
    socket.addEventListener("message", (event) => {
      setLogs((l) => {
        let newLogs = l.concat(JSON.parse(event.data));
        return newLogs.slice(Math.max(l.length - limit, 0));
      });
    });
    return () => socket.close();
  }, [streamName, limit]);
  return (
    <Container maxWidth="lg">
      <LogList logs={logs} />
    </Container>
  );
};

export default LogTailer;
