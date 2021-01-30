import {
  Container,
  Paper,
  ListItem,
  ListItemText,
  List,
} from "@material-ui/core";
import React, { useState, useEffect } from "react";
import { createStyles, makeStyles } from "@material-ui/core/styles";
interface Props {
  streamName: string;
  limit: number;
}

const useStyles = makeStyles(() =>
  createStyles({
    panelSize: {
      maxHeight: "80vh",
      overflowY: "scroll",
    },
  })
);
const LogTailer: React.FC<Props> = ({ streamName, limit }) => {
  let [logs, setLogs] = useState<string[]>([]);
  const classes = useStyles();
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
      <Paper className={classes.panelSize}>
        <List>
          {logs.map((l, i) => (
            <ListItem key={i}>
              <ListItemText primary={l} />
            </ListItem>
          ))}
        </List>
      </Paper>
    </Container>
  );
};

export default LogTailer;
