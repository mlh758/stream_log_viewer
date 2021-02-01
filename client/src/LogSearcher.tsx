import React, { useState, useEffect } from "react";
import { Container, LinearProgress } from "@material-ui/core";
import LoadingState from "./LoadingState";
import LogList from "./LogList";

interface Props {
  startAt: Date;
  endAt: Date;
  term: string | null;
  stream: string;
}

const LogSearcher: React.FC<Props> = ({ startAt, endAt, term, stream }) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState<LoadingState>(LoadingState.Loading);

  useEffect(() => {
    let query = `/api/search_logs/${stream}?start=${startAt.toISOString()}&end=${endAt.toISOString()}`;
    if (term && term.length > 0) {
      query = `${query}&term=${term}`;
    }
    const controller = new AbortController();
    fetch(query, { signal: controller.signal })
      .then((reply) => {
        if (reply.ok) {
          return reply.json();
        }
        throw new Error("unable to load logs");
      })
      .then((logs) => {
        setLoading(LoadingState.Ready);
        setLogs(logs);
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setLoading(LoadingState.Error);
        }
      });
    return () => controller.abort();
  }, [startAt, endAt, term, stream]);

  return (
    <Container>
      {loading === LoadingState.Loading && <LinearProgress />}
      {loading === LoadingState.Ready && <LogList logs={logs} />}
    </Container>
  );
};

export default LogSearcher;
