import React from "react";
import { render } from "@testing-library/react";

import LogList from "./LogList";

const logs: string[] = ["line", "line", "line"];

test("renders a list of log items", () => {
  const { getAllByText } = render(<LogList logs={logs} />);
  expect(getAllByText("line").length).toEqual(3);
});

test("handles an empty list", () => {
  render(<LogList logs={[]} />);
  expect(document.getElementsByTagName("ul").length).toEqual(1);
});
