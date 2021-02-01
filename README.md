# Redis Stream Log Viewer

This is a log viewer for logs written to Redis streams. There is a Rails implementation for such a logger [here](https://github.com/mlh758/redis_stream_logger).

## TODO

1. Tests
2. Configurable Redis connection
3. Self-host static content from React app so that this can be deployed somewhere

## Running for development

`cargo run` in the root folder and `yarn start` in the client folder will get the app running. You will
need Redis 5+ running on port 6379, I usually do this with Docker.
