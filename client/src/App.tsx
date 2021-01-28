import React, { useState, useEffect } from "react";
import "./App.css";

function App() {
  useEffect(() => {
    const socket = new WebSocket("ws://localhost:3000/api/tail/rails-log");
    socket.addEventListener("message", (event) => {
      setLogs((l) => l.concat(JSON.parse(event.data)));
    });
    return () => socket.close();
  }, []);
  let [logs, setLogs] = useState<string[]>([]);
  return (
    <div className="App">
      <h1>Logs</h1>
      <ul>
        {logs.map((l) => (
          <li>{l}</li>
        ))}
      </ul>
    </div>
  );
}

export default App;
