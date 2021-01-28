use mpsc::Receiver;
use r2d2::Pool;
use redis::{Commands, RedisResult};
use std::convert::Infallible;
use std::sync::Arc;
use tokio::signal::unix::SignalKind;
use tokio::sync::mpsc;
use tokio::{select, signal::unix::signal};
use warp::ws::WebSocket;
use warp::Filter;
mod replies;
use replies::LogListener;
type RedisPool = Arc<Pool<redis::Client>>;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut rx = listen_for_shutdown();
    let pool = Arc::new(open_redis()?);
    let routes = warp::get().and(warp::path("api"));
    let stream_pool = pool.clone();
    let log_stream = warp::path!("tail" / String)
        .and(warp::ws())
        .and(with_redis(stream_pool))
        .map(|log_stream: String, ws: warp::ws::Ws, redis: RedisPool| {
            ws.on_upgrade(move |socket| tail_logs(socket, redis, log_stream))
        });
    let available_logs = warp::path("available_logs")
        .and(with_redis(pool))
        .and_then(get_log_keys);
    let routes = routes.and(log_stream.or(available_logs));
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

async fn get_log_keys(pool: RedisPool) -> Result<Box<dyn warp::Reply>, Infallible> {
    if let Ok(mut redis) = pool.get() {
        let key_result: RedisResult<Vec<String>> = redis.smembers("log-streams");
        match key_result {
            Ok(keys) => Ok(Box::new(warp::reply::json(&keys))),
            Err(e) => {
                println!("error loading log keys: {}", e);
                Ok(Box::new(warp::http::StatusCode::INTERNAL_SERVER_ERROR))
            }
        }
    } else {
        Ok(Box::new(warp::http::StatusCode::INTERNAL_SERVER_ERROR))
    }
}

async fn tail_logs(ws: WebSocket, redis: RedisPool, log_key: String) {
    match redis.get() {
        Ok(pooled) => {
            let mut listener = LogListener::new(pooled, log_key);
            listener.tail_log(ws).await;
        }
        Err(_) => {
            if let Err(e) = ws.close().await {
                println!("error closing socket {}", e);
            }
        }
    }
}
