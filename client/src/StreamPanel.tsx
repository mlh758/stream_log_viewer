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
import LogSearcher from "./LogSearcher";
import SearchControls from "./SearchControls";

interface Props {
  streams: string[];
}

interface SearchOptions {
  startAt: Date;
  endAt: Date;
  term: string | null;
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
  const [search, setSearch] = useState<SearchOptions | null>(null);
  const handleStreamChanged = (
    event: React.ChangeEvent<{ value: unknown }>
  ) => {
    const newStream = event.target.value as string;
    setStream(newStream);
    if (newStream === "") {
      setTailing(false);
    }
  };
  const handleTailingChanged = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(null);
    setTailing(event.target.checked);
  };
  const handleLimitChanged = (event: React.ChangeEvent<{ value: unknown }>) => {
    setLogLimit(event.target.value as number);
  };

  const handleSearch = (startAt: Date, endAt: Date, term: string | null) => {
    setSearch({ startAt, endAt, term });
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
          <InputLabel id="log-limit-label">Log Tail Line Limit</InputLabel>
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
                  disabled={stream === ""}
                  checked={tailing}
                  onChange={handleTailingChanged}
                  name="tailLogs"
                />
              }
              label="Tail Logs"
            />
          </FormGroup>
        </div>
        <SearchControls
          disabled={stream === "" || tailing}
          controlSpacing={styles.controlSpacing}
          onSearch={handleSearch}
        />
      </Grid>
      <Grid item xs={8}>
        {tailing && <LogTailer streamName={stream} limit={logLimit} />}
        {search !== null && !tailing && (
          <LogSearcher
            startAt={search.startAt}
            endAt={search.endAt}
            term={search.term}
            stream={stream}
          />
        )}
      </Grid>
    </Grid>
  );
};

export default StreamPanel;
