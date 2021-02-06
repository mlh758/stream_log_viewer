import React, { useState, useEffect } from "react";
import AppBar from "@material-ui/core/AppBar";
import { createStyles, makeStyles, Theme } from "@material-ui/core/styles";
import Typography from "@material-ui/core/Typography";
import Toolbar from "@material-ui/core/Toolbar";
import LoadingState from "./LoadingState";
import { LinearProgress } from "@material-ui/core";
import { MuiPickersUtilsProvider } from "@material-ui/pickers";
import DateFnsUtils from "@date-io/date-fns";
import Alert from "@material-ui/lab/Alert";
import StreamPanel from "./StreamPanel";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      flexGrow: 1,
    },
    menuButton: {
      marginRight: theme.spacing(2),
    },
    title: {
      flexGrow: 1,
    },
    contentSpacing: {
      marginTop: "80px",
      padding: theme.spacing(2),
    },
  })
);

const App = () => {
  const [logStreams, setLogStreams] = useState<string[]>([]);
  const [loading, setLoading] = useState<LoadingState>(LoadingState.Loading);
  const classes = useStyles();
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/available_logs", { signal: controller.signal })
      .then((reply) => {
        if (reply.ok) {
          return reply.json();
        }
        throw new Error("unable to get logs");
      })
      .then((data) => {
        setLoading(LoadingState.Ready);
        setLogStreams(data);
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          setLoading(LoadingState.Error);
        }
      });
    return () => controller.abort();
  }, []);
  return (
    <div className={classes.root}>
      <AppBar>
        <Toolbar>
          <Typography variant="h6" className={classes.title}>
            Log Viewer
          </Typography>
        </Toolbar>
      </AppBar>
      <MuiPickersUtilsProvider utils={DateFnsUtils}>
        <main className={classes.contentSpacing}>
          {loading === LoadingState.Loading && (
            <LinearProgress variant="query" />
          )}
          {loading === LoadingState.Error && (
            <Alert severity="error">
              Unable to load available log streams.
            </Alert>
          )}
          {loading === LoadingState.Ready && (
            <StreamPanel streams={logStreams} />
          )}
        </main>
      </MuiPickersUtilsProvider>
    </div>
  );
};

export default App;
