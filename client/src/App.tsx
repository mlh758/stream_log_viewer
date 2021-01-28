import React, { useState, useEffect } from "react";
import AppBar from "@material-ui/core/AppBar";
import { createStyles, makeStyles, Theme } from "@material-ui/core/styles";
import Typography from "@material-ui/core/Typography";
import IconButton from "@material-ui/core/IconButton";
import MenuIcon from "@material-ui/icons/Menu";
import Toolbar from "@material-ui/core/Toolbar";
import Menu from "@material-ui/core/Menu";
import MenuItem from "@material-ui/core/MenuItem";
import LoadingState from "./LoadingState";
import { LinearProgress } from "@material-ui/core";
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
  const [currentStream, setCurrentStream] = useState<string>("");
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
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
      .catch(() => setLoading(LoadingState.Error));
    return () => controller.abort();
  }, []);
  const handleMenuClose = () => {
    setMenuAnchor(null);
  };
  const handleMenuOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (logStreams.length === 0) {
      return;
    }
    setMenuAnchor(event.currentTarget);
  };
  return (
    <div className={classes.root}>
      <Menu
        id="stream-select"
        onClose={handleMenuClose}
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
      >
        {logStreams.map((ls) => (
          <MenuItem key={ls} onClick={() => setCurrentStream(ls)}>
            {ls}
          </MenuItem>
        ))}
      </Menu>
      <AppBar>
        <Toolbar>
          <IconButton
            className={classes.menuButton}
            onClick={handleMenuOpen}
            aria-haspopup="true"
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" className={classes.title}>
            Log Viewer
          </Typography>
        </Toolbar>
      </AppBar>
      <main className={classes.contentSpacing}>
        {loading === LoadingState.Loading && <LinearProgress variant="query" />}
        {currentStream.length > 0 && <StreamPanel streamName={currentStream} />}
      </main>
    </div>
  );
};

export default App;
