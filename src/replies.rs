use futures::{SinkExt, StreamExt};
use mpsc::UnboundedSender;
use r2d2::PooledConnection;
use redis::{streams::StreamReadOptions, streams::StreamReadReply, Commands, RedisResult};
use tokio::select;
use tokio::sync::mpsc;
use tokio::time::{sleep, Duration};
use warp::ws::{Message, WebSocket};
pub struct LogListener {
    redis: PooledConnection<redis::Client>,
    log_key: String,
}

impl LogListener {
    pub fn new(redis: PooledConnection<redis::Client>, log_key: String) -> Self {
        LogListener { redis, log_key }
    }
    // TODO: check of log_chan has been closed in the loop
    pub async fn tail_log(&mut self, ws: WebSocket) {
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