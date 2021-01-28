use futures::{SinkExt, StreamExt};
use mpsc::{Receiver, UnboundedSender};
use r2d2::{Pool, PooledConnection};
use redis::{streams::StreamReadOptions, streams::StreamReadReply, Commands, RedisResult};
use std::convert::Infallible;
use std::sync::Arc;
use tokio::signal::unix::SignalKind;
use tokio::sync::mpsc;
use tokio::time::{sleep, Duration};
use tokio::{select, signal::unix::signal};
use warp::ws::{Message, WebSocket};
use warp::Filter;

type RedisPool = Arc<Pool<redis::Client>>;

struct LogListener {
    redis: PooledConnection<redis::Client>,
    log_key: String,
}

impl LogListener {
    // TODO: check of log_chan has been closed in the loop
    async fn tail_log(&mut self, ws: WebSocket) {
        let log_chan = self.mediate_messages(ws);
        let mut last_id = "0".to_string();
        loop {
            let read_opts = StreamReadOptions::default().count(50);
            let log_reply: RedisResult<StreamReadReply> =
                self.redis
                    .xread_options(&[&self.log_key], &[&last_id], read_opts);
            match log_reply {
                Ok(reply) => {
                    let mut lines = Vec::new();
                    if reply.keys.len() == 0 {
                        // we should use the blocking version of this command later, but need async redis working first
                        println!("no new logs, waiting before trying again");
                        sleep(Duration::from_secs(5)).await;
                        continue;
                    }
                    for val in &reply.keys[0].ids {
                        last_id = val.id.clone();
                        for (_k, v) in &val.map {
                            if let redis::Value::Data(bytes) = v {
                                lines.push(
                                    String::from_utf8(bytes.to_owned())
                                        .expect("redis should always have utf8"),
                                );
                            }
                        }
                    }
                    if let Err(_) = log_chan.send(lines) {
                        println!("Unable to send log lines on channel");
                        break;
                    }
                }
                Err(e) => {
                    println!("Stream read failed: {}", e);
                    drop(log_chan);
                    break;
                }
            }
        }
    }
    fn mediate_messages(&self, ws: WebSocket) -> UnboundedSender<Vec<String>> {
        let (tx, mut rx) = mpsc::unbounded_channel::<Vec<String>>();
        tokio::spawn(async move {
            let (mut ws_tx, mut ws_rx) = ws.split();
            loop {
                select! {
                    msg_result = ws_rx.next() => {
                        match msg_result {
                            None => break,
                            Some(Err(_)) => println!("error getting message"),
                            Some(Ok(msg)) => {
                                if msg.is_close() {
                                    println!("socket closed by client");
                                    drop(rx);
                                    break;
                                }
                            }
                        };
                    }
                    lines = rx.recv() => {
                        match lines {
                            None => {
                                println!("no more logs");
                                if let Err(_) = ws_tx.send(Message::close()).await {
                                    println!("unable to send close message to client");
                                }
                                break;
                            }
                            Some(logs) => {
                                if let Err(_) = ws_tx.send(Message::text(serde_json::to_string(&logs).unwrap())).await {
                                    println!("error sending message to client");
                                    break;
                                }
                            }
                        }

                    }
                }
            }
        });
        tx
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut rx = listen_for_shutdown();
    let pool = Arc::new(open_redis()?);
    let routes = warp::get().and(warp::path("api"));
    let log_stream = warp::path!("tail" / String)
        .and(warp::ws())
        .and(with_redis(pool))
        .map(|log_stream: String, ws: warp::ws::Ws, redis: RedisPool| {
            ws.on_upgrade(move |socket| tail_logs(socket, redis, log_stream))
        });
    let routes = routes.and(log_stream);
    let (_, server) =
        warp::serve(routes).bind_with_graceful_shutdown(([0, 0, 0, 0], 5000), async move {
            rx.recv().await;
            println!("app shutting down...");
        });
    let task = tokio::spawn(server);
    task.await.map_err(|e| e.into())
}

fn listen_for_shutdown() -> Receiver<usize> {
    let (tx, rx) = mpsc::channel::<usize>(10);
    tokio::spawn(async move {
        let mut int_stream = signal(SignalKind::interrupt()).expect("unable to register handler");
        let mut term_stream = signal(SignalKind::interrupt()).expect("unable to register handler");
        select! {
            _ = int_stream.recv() => (),
            _ = term_stream.recv() => ()
        };
        match tx.send(1).await {
            Ok(_) => println!("notified app of shutdown"),
            Err(_) => println!("unable to notify app of shutdown"),
        };
    });
    rx
}

fn open_redis() -> Result<Pool<redis::Client>, Box<dyn std::error::Error>> {
    let client = redis::Client::open("redis://localhost:6379/12")?;
    r2d2::Pool::builder().build(client).map_err(|e| e.into())
}

/// Clones the oracle Arc<Pool<Client>> to be used with a handler
fn with_redis(redis: RedisPool) -> impl Filter<Extract = (RedisPool,), Error = Infallible> + Clone {
    warp::any().map(move || redis.clone())
}

async fn tail_logs(ws: WebSocket, redis: RedisPool, log_key: String) {
    match redis.get() {
        Ok(pooled) => {
            let mut listener = LogListener {
                redis: pooled,
                log_key,
            };
            listener.tail_log(ws).await;
        }
        Err(_) => {
            if let Err(e) = ws.close().await {
                println!("error closing socket {}", e);
            }
        }
    }
}
