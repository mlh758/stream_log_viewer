use mpsc::Receiver;
use redis::{aio::ConnectionManager, AsyncCommands, RedisResult};
use std::convert::Infallible;
use tokio::signal::unix::SignalKind;
use tokio::sync::mpsc;
use tokio::{select, signal::unix::signal};
use warp::ws::WebSocket;
use warp::Filter;
mod replies;
use replies::LogListener;
use serde_derive::Deserialize;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut rx = listen_for_shutdown();
    let pool = open_redis().await?;
    let routes = warp::get().and(warp::path("api"));
    let stream_pool = pool.clone();
    let log_stream = warp::path!("tail" / String)
        .and(warp::ws())
        .and(with_redis(stream_pool))
        .map(
            |log_stream: String, ws: warp::ws::Ws, redis: ConnectionManager| {
                ws.on_upgrade(move |socket| tail_logs(socket, redis, log_stream))
            },
        );
    let available_logs_pool = pool.clone();
    let available_logs = warp::path("available_logs")
        .and(with_redis(available_logs_pool))
        .and_then(get_log_keys);
    let search_pool = pool.clone();
    let search_logs = warp::path!("search_logs" / String)
        .and(warp::query::<SearchParams>())
        .and(with_redis(search_pool))
        .and_then(search_logs);
    let routes = routes.and(log_stream.or(available_logs).or(search_logs));
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

async fn open_redis() -> Result<redis::aio::ConnectionManager, Box<dyn std::error::Error>> {
    let client = redis::Client::open("redis://localhost:6379/12")?;
    client
        .get_tokio_connection_manager()
        .await
        .map_err(|e| e.into())
}

/// Clones the oracle Arc<Pool<Client>> to be used with a handler
fn with_redis(
    redis: ConnectionManager,
) -> impl Filter<Extract = (ConnectionManager,), Error = Infallible> + Clone {
    warp::any().map(move || redis.clone())
}
#[derive(Deserialize)]
struct SearchParams {
    start: chrono::DateTime<chrono::Utc>,
    end: chrono::DateTime<chrono::Utc>,
    term: Option<String>,
}

async fn search_logs(
    log_stream: String,
    params: SearchParams,
    mut redis: ConnectionManager,
) -> Result<Box<dyn warp::Reply>, Infallible> {
    match redis
        .xrange(
            &log_stream,
            params.start.timestamp_millis(),
            params.end.timestamp_millis(),
        )
        .await
    {
        Ok(range) => {
            let data = replies::flatten_xrange(range, params.term);
            Ok(Box::new(warp::reply::json(&data)))
        }
        Err(e) => {
            println!("error getting log range: {}", e);
            Ok(Box::new(warp::http::StatusCode::INTERNAL_SERVER_ERROR))
        }
    }
}

async fn get_log_keys(mut redis: ConnectionManager) -> Result<Box<dyn warp::Reply>, Infallible> {
    let key_result: RedisResult<Vec<String>> = redis.smembers("log-streams").await;
    match key_result {
        Ok(keys) => Ok(Box::new(warp::reply::json(&keys))),
        Err(e) => {
            println!("error loading log keys: {}", e);
            Ok(Box::new(warp::http::StatusCode::INTERNAL_SERVER_ERROR))
        }
    }
}

async fn tail_logs(ws: WebSocket, redis: ConnectionManager, log_key: String) {
    let mut listener = LogListener::new(redis, log_key);
    listener.tail_log(ws).await;
}
