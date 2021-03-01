import React, { useState } from "react";
import { KeyboardDateTimePicker } from "@material-ui/pickers";
import SearchIcon from "@material-ui/icons/Search";
import { InputAdornment, Input, Button, InputLabel } from "@material-ui/core";

type SearchCallback = (start: Date, end: Date, term: string) => void;
interface Props {
  onSearch: SearchCallback;
  controlSpacing: string;
  disabled: boolean;
}

const SearchControls: React.FC<Props> = ({
  onSearch,
  controlSpacing,
  disabled,
}) => {
  const [startAt, setStartAt] = useState<Date | null>(new Date());
  const [endAt, setEndAt] = useState<Date | null>(new Date());
  const [searchText, setSearchText] = useState<string>("");
  const handleSearchChanged = (
    event: React.ChangeEvent<{ value: unknown }>
  ) => {
    setSearchText(event.target.value as string);
  };
  const handleSearchClicked = () => {
    if (startAt && endAt) {
      onSearch(startAt, endAt, searchText);
    }
  };

  return (
    <>
      <div className={controlSpacing}>
        <KeyboardDateTimePicker
          disabled={disabled}
          label="Log Range Start"
          value={startAt}
          onChange={setStartAt}
        />
      </div>
      <div className={controlSpacing}>
        <KeyboardDateTimePicker
          disabled={disabled}
          label="Log Range End"
          value={endAt}
          onChange={setEndAt}
        />
      </div>
      <div className={controlSpacing}>
        <InputLabel htmlFor="log-search-text">Log Search</InputLabel>
        <Input
          disabled={disabled}
          id="log-search-text"
          value={searchText}
          onChange={handleSearchChanged}
          startAdornment={
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          }
        />
      </div>
      <div className={controlSpacing}>
        <Button
          disabled={disabled || startAt === null || endAt === null}
          onClick={handleSearchClicked}
        >
          Search Logs
        </Button>
      </div>
    </>
  );
};

export default SearchControls;
