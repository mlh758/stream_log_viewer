import React from "react";
import { render, waitFor } from "@testing-library/react";
import { FetchMock } from "jest-fetch-mock";
import App from "./App";

const fetchMock = fetch as FetchMock;

beforeEach(() => {
  fetchMock.resetMocks();
});

test("renders learn react link", async () => {
  fetchMock.mockResponseOnce(JSON.stringify([]));
  const { getByText } = render(<App />);
  await waitFor(() => undefined);
  expect(getByText("Log Viewer")).toBeInTheDocument();
});

test("renders error banner when load fails", async () => {
  fetchMock.mockRejectOnce(new Error("dead"));
  const { getByText } = render(<App />);
  await waitFor(() => undefined);
  expect(getByText(/unable to load/i)).toBeInTheDocument();
});
