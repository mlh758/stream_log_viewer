import React from "react";
import { render, fireEvent } from "@testing-library/react";
import { MuiPickersUtilsProvider } from "@material-ui/pickers";
import DateFnsUtils from "@date-io/date-fns";
import SearchControls from "./SearchControls";

const defaultProps = {
  onSearch: jest.fn(),
  controlSpacing: "",
};
const renderWrapper = (props: any) =>
  render(
    <MuiPickersUtilsProvider utils={DateFnsUtils}>
      <SearchControls {...props} />
    </MuiPickersUtilsProvider>
  );

test("disables the search button when disabled prop is set", () => {
  const { getByText } = renderWrapper({ ...defaultProps, disabled: true });
  expect(getByText("Search Logs").parentElement).toBeDisabled();
});

test("calls on onSearch function when enabled and search is clicked", () => {
  const callback = jest.fn();
  const { getByText } = renderWrapper({ ...defaultProps, onSearch: callback });
  getByText("Search Logs").click();
  expect(callback.mock.calls.length).toEqual(1);
});

test("sends the search text to the callback", () => {
  const callback = jest.fn();
  const { getByLabelText, getByText } = renderWrapper({
    ...defaultProps,
    onSearch: callback,
  });
  const input = getByLabelText("Log Search");
  fireEvent.change(input, { target: { value: "search text" } });
  getByText("Search Logs").click();
  expect(callback.mock.calls[0][2]).toEqual("search text");
});
