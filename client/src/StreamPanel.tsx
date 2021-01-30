import React, { useState } from "react";
import {
  Typography,
  Grid,
  Select,
  MenuItem,
  InputLabel,
  FormGroup,
  FormControlLabel,
  Switch,
} from "@material-ui/core";
import { createStyles, makeStyles, Theme } from "@material-ui/core/styles";
import LogTailer from "./LogTailer";

interface Props {
  streams: string[];
}

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    controlSpacing: {
      marginBottom: theme.spacing(3),
    },
  })
);

const noStream = "Select a stream";
const logLimitOptions = [50, 100, 500, 1000];

const StreamPanel: React.FC<Props> = ({ streams }) => {
  const styles = useStyles();
  const [stream, setStream] = useState<string>("");
  const [tailing, setTailing] = useState(false);
  const [logLimit, setLogLimit] = useState(logLimitOptions[0]);
  const handleStreamChanged = (
    event: React.ChangeEvent<{ value: unknown }>
  ) => {
    setStream(event.target.value as string);
  };
  const handleTailingChanged = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTailing(event.target.checked);
  };
  const handleLimitChanged = (event: React.ChangeEvent<{ value: unknown }>) => {
    setLogLimit(event.target.value as number);
  };
  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Typography variant="h4">
          {stream.length > 0 ? stream : noStream}
        </Typography>
      </Grid>
      <Grid item xs={4}>
        <div className={styles.controlSpacing}>
          <InputLabel id="stream-select-label">Available Streams</InputLabel>
          <Select
            labelId="stream-select-label"
            id="stream-select"
            onChange={handleStreamChanged}
            value={stream}
          >
            <MenuItem value="" key={-1}>
              {noStream}
            </MenuItem>
            {streams.map((s, i) => (
              <MenuItem value={s} key={i}>
                {s}
              </MenuItem>
            ))}
          </Select>
        </div>
        <div className={styles.controlSpacing}>
          <InputLabel id="log-limit-label">Log Item Limit</InputLabel>
          <Select
            labelId="log-limit-label"
            id="log-limit"
            onChange={handleLimitChanged}
            value={logLimit}
          >
            {logLimitOptions.map((opt, i) => (
              <MenuItem value={opt} key={i}>
                {opt}
              </MenuItem>
            ))}
          </Select>
        </div>
        <div className={styles.controlSpacing}>
          <FormGroup row>
            <FormControlLabel
              control={
                <Switch
                  checked={tailing}
                  onChange={handleTailingChanged}
                  name="tailLogs"
                />
              }
              label="Tail Logs"
            />
          </FormGroup>
        </div>
      </Grid>
      <Grid item xs={8}>
        {stream.length > 0 && tailing && (
          <LogTailer streamName={stream} limit={logLimit} />
        )}
      </Grid>
    </Grid>
  );
};

export default StreamPanel;
