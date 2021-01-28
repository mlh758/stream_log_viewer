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
}

const useStyles = makeStyles(() =>
  createStyles({
    panelSize: {
      maxHeight: "80vh",
      overflowY: "scroll",
    },
  })
);
const LogTailer: React.FC<Props> = ({ streamName }) => {
  let [logs, setLogs] = useState<string[]>([]);
  const classes = useStyles();
  useEffect(() => {
    const socket = new WebSocket(`ws://localhost:3000/api/tail/${streamName}`);
    socket.addEventListener("message", (event) => {
      setLogs((l) => l.concat(JSON.parse(event.data)));
    });
    return () => socket.close();
  }, [streamName]);
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
