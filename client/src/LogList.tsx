import React from "react";
import { Paper, ListItem, ListItemText, List } from "@material-ui/core";
import { createStyles, makeStyles } from "@material-ui/core/styles";
const useStyles = makeStyles(() =>
  createStyles({
    panelSize: {
      minHeight: "80vh",
      maxHeight: "80vh",
      overflowY: "scroll",
    },
  })
);
interface Props {
  logs: string[];
}
const LogList: React.FC<Props> = ({ logs }) => {
  const classes = useStyles();
  return (
    <Paper className={classes.panelSize}>
      <List>
        {logs.map((l, i) => (
          <ListItem key={i}>
            <ListItemText primary={l} />
          </ListItem>
        ))}
      </List>
    </Paper>
  );
};

export default LogList;
