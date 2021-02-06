import React from "react";
import { render, fireEvent, within } from "@testing-library/react";
import { MuiPickersUtilsProvider } from "@material-ui/pickers";
import DateFnsUtils from "@date-io/date-fns";
import StreamPanel from "./StreamPanel";

const streams = ["log1", "log2"];
const renderWrapper = (props: any) =>
  render(
    <MuiPickersUtilsProvider utils={DateFnsUtils}>
      <StreamPanel {...props} />
    </MuiPickersUtilsProvider>
  );

test("renders a message to select a stream by default", () => {
  const { getByText } = renderWrapper({ streams });
  expect(getByText("Select a stream")).toBeInTheDocument();
});

test("renders the stream name after one is picked", () => {
  const { getByLabelText, getByRole } = renderWrapper({ streams });
  const select = getByLabelText("Available Streams");
  fireEvent.mouseDown(select);
  const listbox = within(getByRole("listbox"));
  fireEvent.click(listbox.getByText("log1"));
  expect(document.querySelectorAll("h4")[0].textContent).toEqual("log1");
});
