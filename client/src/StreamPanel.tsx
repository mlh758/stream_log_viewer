import { Typography } from "@material-ui/core";
import React from "react";
import LogTailer from "./LogTailer";

interface Props {
  streamName: string;
}

const StreamPanel: React.FC<Props> = ({ streamName }) => (
  <div>
    <Typography variant="h3">{streamName}</Typography>
    <LogTailer streamName={streamName} />
  </div>
);

export default StreamPanel;
