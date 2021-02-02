use futures::{SinkExt, StreamExt};
use log::{error, info, warn};
use mpsc::UnboundedSender;
use redis::{
    aio::ConnectionManager,
    streams::StreamReadOptions,
    streams::{StreamRangeReply, StreamReadReply},
    AsyncCommands, RedisResult,
};
use tokio::select;
use tokio::sync::mpsc;
use warp::ws::{Message, WebSocket};
pub struct LogListener {
    redis: ConnectionManager,
    log_key: String,
}

impl LogListener {
    pub fn new(redis: ConnectionManager, log_key: String) -> Self {
        LogListener { redis, log_key }
    }
    pub async fn tail_log(&mut self, ws: WebSocket) {
        let log_chan = self.mediate_messages(ws);
        let mut last_id = "$".to_string();
        loop {
            if log_chan.is_closed() {
                return;
            }
            let read_opts = StreamReadOptions::default().count(50).block(5000);
            let log_reply: RedisResult<StreamReadReply> = self
                .redis
                .xread_options(&[&self.log_key], &[&last_id], read_opts)
                .await;
            match log_reply {
                Ok(reply) => {
                    let mut lines = Vec::new();
                    if reply.keys.len() == 0 {
                        continue; // just wait again if no logs came through
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
                        warn!("Unable to send log lines on channel");
                        break;
                    }
                }
                Err(e) => {
                    warn!("Stream read failed: {}", e);
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
                            Some(Err(e)) => error!("error getting message: {}", e),
                            Some(Ok(msg)) => {
                                if msg.is_close() {
                                    info!("socket closed by client");
                                    drop(rx);
                                    break;
                                }
                            }
                        };
                    }
                    lines = rx.recv() => {
                        match lines {
                            None => {
                                if let Err(_) = ws_tx.send(Message::close()).await {
                                    warn!("unable to send close message to client");
                                }
                                break;
                            }
                            Some(logs) => {
                                if let Err(_) = ws_tx.send(Message::text(serde_json::to_string(&logs).unwrap())).await {
                                    error!("error sending message to client");
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

pub fn flatten_xrange(range: StreamRangeReply, term: Option<String>) -> Vec<String> {
    let mut results = Vec::new();
    for stream_id in &range.ids {
        for (_k, v) in &stream_id.map {
            if let redis::Value::Data(bytes) = v {
                results.push(
                    String::from_utf8(bytes.to_owned()).expect("redis should always have utf8"),
                );
            }
        }
    }
    if let Some(term) = term {
        return results
            .into_iter()
            .filter(|line| line.contains(&term))
            .collect();
    }
    results
}
