FROM rust:1.49 as rust-build

WORKDIR /home/builder
RUN USER=root cargo new stream-log-viewer
WORKDIR /home/builder/stream-log-viewer
# Copy and build dependencies separately from app to improve subsequent build times
COPY Cargo.toml Cargo.lock ./
RUN cargo build --release
COPY src ./src
RUN touch -m src/main.rs
RUN cargo build --release


FROM node:14-buster-slim as node-build
WORKDIR /home/builder/client
COPY client .
RUN yarn install
RUN yarn build

FROM debian:buster-slim
RUN useradd deploy
USER deploy
WORKDIR /home/deploy/app
COPY --chown=deploy --from=rust-build /home/builder/stream-log-viewer/target/release/stream-log-viewer /home/deploy/app/service
COPY --chown=deploy --from=node-build /home/builder/client/build /home/deploy/app/public
EXPOSE 5000
ENTRYPOINT ["/home/deploy/app/service"]