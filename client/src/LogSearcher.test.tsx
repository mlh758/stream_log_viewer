import React from "react";
import LogSearcher from "./LogSearcher";
import { render, waitFor } from "@testing-library/react";
import { FetchMock } from "jest-fetch-mock";

const fetchMock = fetch as FetchMock;
const startDate = new Date("2020-05-01T16:50:00Z");
const endDate = new Date("2020-05-01T17:00:00Z");

beforeEach(() => {
  fetchMock.resetMocks();
});

test("queries for date range and stream name", async () => {
  fetchMock.mockResponseOnce(JSON.stringify(["line"]));
  const { getByText } = render(
    <LogSearcher
      startAt={startDate}
      endAt={endDate}
      stream="test-stream"
      term={null}
    />
  );
  await waitFor(() => undefined);
  expect(getByText("line")).toBeInTheDocument();
  const mockCall = fetchMock.mock.calls[0][0];
  expect(mockCall).toContain("test-stream");
  expect(mockCall).toContain("16:50");
  expect(mockCall).toContain("17:00");
  expect(mockCall).not.toContain("term");
});

test("queries for the term when one is provided", async () => {
  fetchMock.mockResponseOnce(JSON.stringify(["line"]));
  const { getByText } = render(
    <LogSearcher
      startAt={startDate}
      endAt={endDate}
      stream="test-stream"
      term="hello"
    />
  );
  await waitFor(() => undefined);
  expect(getByText("line")).toBeInTheDocument();
  const mockCall = fetchMock.mock.calls[0][0];
  expect(mockCall).toContain("term=hello");
});

test("displays a message when the search fails", async () => {
  fetchMock.mockRejectOnce(new Error("dee"));
  const { getByText } = render(
    <LogSearcher
      startAt={startDate}
      endAt={endDate}
      stream="test-stream"
      term="hello"
    />
  );
  await waitFor(() => undefined);
  expect(getByText(/something went wrong/i)).toBeInTheDocument();
});
