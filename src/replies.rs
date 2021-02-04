use futures::{SinkExt, StreamExt};
use log::{error, info, warn};
use mpsc::UnboundedSender;
use redis::{
    aio::ConnectionManager,
    streams::StreamReadOptions,
    streams::{StreamRangeReply, StreamReadReply},
    AsyncCommands, RedisResult,
};
use serde_derive::Deserialize;
use std::convert::Infallible;
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
                Ok(mut reply) => {
                    if reply.keys.is_empty() {
                        continue; // just wait again if no logs came through
                    }
                    last_id = reply.keys[0].ids.iter().last().unwrap().id.clone();
                    let values = reply
                        .keys
                        .remove(0)
                        .ids
                        .into_iter()
                        .flat_map(|id| id.map.into_iter().map(|(_, v)| v))
                        .filter_map(string_or_none);
                    if log_chan.send(values.collect()).is_err() {
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
                                if ws_tx.send(Message::close()).await.is_err() {
                                    warn!("unable to send close message to client");
                                }
                                break;
                            }
                            Some(logs) => {
                                if ws_tx.send(Message::text(serde_json::to_string(&logs).unwrap())).await.is_err() {
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

fn string_or_none(val: redis::Value) -> Option<String> {
    match val {
        redis::Value::Data(bytes) => match String::from_utf8(bytes) {
            Ok(s) => Some(s),
            Err(_) => None,
        },
        _ => None,
    }
}
// converts a StreamRangeReply to a Vec of strings by flattening out all the maps
fn flatten_xrange(range: StreamRangeReply, term: &Option<String>) -> Vec<String> {
    let values = range
        .ids
        .into_iter()
        .flat_map(|id| id.map.into_iter().map(|(_, v)| v))
        .filter_map(string_or_none);

    if let Some(term) = term {
        return values.filter(|line| line.contains(term)).collect();
    }
    values.collect()
}

#[derive(Deserialize)]
pub struct SearchParams {
    start: chrono::DateTime<chrono::Utc>,
    end: chrono::DateTime<chrono::Utc>,
    term: Option<String>,
}

pub async fn search_logs(
    log_stream: String,
    params: SearchParams,
    mut redis: ConnectionManager,
) -> Result<Box<dyn warp::Reply>, Infallible> {
    let mut start_at = format!("{}-0", params.start.timestamp_millis());
    let end_at = params.end.timestamp_millis();
    let mut reply: Vec<String> = Vec::new();
    loop {
        let range: RedisResult<StreamRangeReply> = redis
            .xrange_count(&log_stream, &start_at, end_at, 1000)
            .await;
        match range {
            Ok(xrange) => {
                if xrange.ids.is_empty() {
                    break;
                }
                let returned_count = xrange.ids.len();
                let new_start_at = xrange.ids.iter().last().unwrap().id.clone();
                // protect against having exactly 1000 items left in the stream
                if new_start_at == start_at {
                    break;
                }
                start_at = new_start_at;
                let mut data = flatten_xrange(xrange, &params.term);
                reply.append(&mut data);
                // stop if we already have 1000 results or Redis returned fewer than our batch size
                if reply.len() > 1000 || returned_count < 1000 {
                    break;
                }
            }
            Err(e) => {
                error!("error getting log range: {}", e);
                return Ok(Box::new(warp::http::StatusCode::INTERNAL_SERVER_ERROR));
            }
        }
    }
    reply.truncate(1000);
    Ok(Box::new(warp::reply::json(&reply)))
}
