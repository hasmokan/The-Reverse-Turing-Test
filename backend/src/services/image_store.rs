use base64::Engine;
use sqlx::PgPool;
use std::sync::Arc;
use uuid::Uuid;

use crate::config::Config;
use crate::services::ApiError;

pub struct ImageBytes {
    pub content_type: &'static str,
    pub bytes: Vec<u8>,
}

#[async_trait::async_trait]
pub trait ImageStore: Send + Sync {
    async fn prepare_drawing_image_data(
        &self,
        drawing_id: Uuid,
        image_data: &str,
    ) -> Result<String, ApiError>;

    async fn get_drawing_image(
        &self,
        db: &PgPool,
        drawing_id: Uuid,
    ) -> Result<ImageBytes, ApiError>;
}

pub struct DbDataUrlImageStore;

pub struct OpendalS3ImageStore {
    op: opendal::Operator,
}

pub(crate) fn decode_image_data(image_data: &str) -> Result<ImageBytes, ApiError> {
    let (content_type, base64_part) = if let Some(data_url) = image_data.strip_prefix("data:") {
        let comma_idx = data_url
            .find(',')
            .ok_or(ApiError::BadRequest("Invalid image_data".to_string()))?;
        let meta = &data_url[..comma_idx];
        let base64_part = &data_url[(comma_idx + 1)..];

        let mut parts = meta.split(';');
        let mime = parts.next().unwrap_or_default();
        let is_base64 = parts.any(|p| p == "base64");
        if !is_base64 {
            return Err(ApiError::BadRequest("Invalid image_data".to_string()));
        }

        let content_type = match mime {
            "image/png" => "image/png",
            "image/jpeg" | "image/jpg" => "image/jpeg",
            "image/webp" => "image/webp",
            _ => return Err(ApiError::BadRequest("Invalid image_data".to_string())),
        };

        (content_type, base64_part)
    } else {
        ("image/png", image_data)
    };

    let bytes = base64::engine::general_purpose::STANDARD
        .decode(base64_part)
        .map_err(|_| ApiError::BadRequest("Invalid image_data".to_string()))?;

    Ok(ImageBytes {
        content_type,
        bytes,
    })
}

pub fn build_image_store(config: &Config) -> Result<Arc<dyn ImageStore>, ApiError> {
    match config.image_storage_backend.as_str() {
        "db" => Ok(Arc::new(DbDataUrlImageStore)),
        "s3" => {
            let Some(bucket) = config.s3_bucket.clone() else {
                return Err(ApiError::Internal("S3_BUCKET missing".to_string()));
            };
            let Some(region) = config.s3_region.clone() else {
                return Err(ApiError::Internal("S3_REGION missing".to_string()));
            };
            let Some(endpoint) = config.s3_endpoint.clone() else {
                return Err(ApiError::Internal("S3_ENDPOINT missing".to_string()));
            };
            let Some(access_key_id) = config.s3_access_key_id.clone() else {
                return Err(ApiError::Internal("S3_ACCESS_KEY_ID missing".to_string()));
            };
            let Some(secret_access_key) = config.s3_secret_access_key.clone() else {
                return Err(ApiError::Internal(
                    "S3_SECRET_ACCESS_KEY missing".to_string(),
                ));
            };

            let root = if config.s3_root.starts_with('/') {
                config.s3_root.clone()
            } else {
                format!("/{}", config.s3_root)
            };

            let builder = opendal::services::S3::default()
                .root(&root)
                .bucket(&bucket)
                .region(&region)
                .endpoint(&endpoint)
                .access_key_id(&access_key_id)
                .secret_access_key(&secret_access_key);

            let op = opendal::Operator::new(builder)
                .map_err(|e| {
                    tracing::error!("Failed to init storage operator: {}", e);
                    ApiError::Internal("Storage init failed".to_string())
                })?
                .finish();

            Ok(Arc::new(OpendalS3ImageStore { op }))
        }
        other => Err(ApiError::Internal(format!(
            "Unsupported IMAGE_STORAGE_BACKEND: {}",
            other
        ))),
    }
}

fn parse_od_s3_marker(image_data: &str) -> Option<(&'static str, &str)> {
    let raw = image_data.strip_prefix("od:s3|")?;
    let (mime, key) = raw.split_once('|')?;
    let mime = match mime {
        "image/png" => "image/png",
        "image/jpeg" | "image/jpg" => "image/jpeg",
        "image/webp" => "image/webp",
        _ => return None,
    };
    Some((mime, key))
}

fn ext_from_content_type(content_type: &str) -> Result<&'static str, ApiError> {
    match content_type {
        "image/png" => Ok("png"),
        "image/jpeg" => Ok("jpg"),
        "image/webp" => Ok("webp"),
        _ => Err(ApiError::BadRequest("Invalid image_data".to_string())),
    }
}

#[async_trait::async_trait]
impl ImageStore for DbDataUrlImageStore {
    async fn prepare_drawing_image_data(
        &self,
        _drawing_id: Uuid,
        image_data: &str,
    ) -> Result<String, ApiError> {
        Ok(image_data.to_string())
    }

    async fn get_drawing_image(
        &self,
        db: &PgPool,
        drawing_id: Uuid,
    ) -> Result<ImageBytes, ApiError> {
        let image_data: Option<String> = sqlx::query_scalar(
            "SELECT image_data FROM drawings WHERE id = $1 AND is_hidden = FALSE",
        )
        .bind(drawing_id)
        .fetch_optional(db)
        .await?
        .flatten();

        let Some(image_data) = image_data else {
            return Err(ApiError::NotFound("Drawing not found".to_string()));
        };

        decode_image_data(&image_data)
    }
}

#[async_trait::async_trait]
impl ImageStore for OpendalS3ImageStore {
    async fn prepare_drawing_image_data(
        &self,
        drawing_id: Uuid,
        image_data: &str,
    ) -> Result<String, ApiError> {
        let decoded = decode_image_data(image_data)?;
        let ext = ext_from_content_type(decoded.content_type)?;
        let key = format!("drawings/{}.{}", drawing_id, ext);

        self.op.write(&key, decoded.bytes).await.map_err(|e| {
            tracing::error!("Failed to write storage object {}: {}", key, e);
            ApiError::Internal("Storage write failed".to_string())
        })?;

        Ok(format!("od:s3|{}|{}", decoded.content_type, key))
    }

    async fn get_drawing_image(
        &self,
        db: &PgPool,
        drawing_id: Uuid,
    ) -> Result<ImageBytes, ApiError> {
        let image_data: Option<String> = sqlx::query_scalar(
            "SELECT image_data FROM drawings WHERE id = $1 AND is_hidden = FALSE",
        )
        .bind(drawing_id)
        .fetch_optional(db)
        .await?
        .flatten();

        let Some(image_data) = image_data else {
            return Err(ApiError::NotFound("Drawing not found".to_string()));
        };

        if let Some((content_type, key)) = parse_od_s3_marker(&image_data) {
            let buf = self.op.read(key).await.map_err(|e| {
                tracing::error!("Failed to read storage object {}: {}", key, e);
                ApiError::Internal("Storage read failed".to_string())
            })?;
            return Ok(ImageBytes {
                content_type,
                bytes: buf.to_vec(),
            });
        }

        decode_image_data(&image_data)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decode_data_url_png_base64() {
        let png_bytes = b"png";
        let encoded = base64::engine::general_purpose::STANDARD.encode(png_bytes);
        let data_url = format!("data:image/png;base64,{}", encoded);
        let decoded = decode_image_data(&data_url).unwrap();
        assert_eq!(decoded.content_type, "image/png");
        assert_eq!(decoded.bytes, png_bytes);
    }

    #[test]
    fn decode_data_url_jpeg_base64() {
        let jpeg_bytes = b"jpeg";
        let encoded = base64::engine::general_purpose::STANDARD.encode(jpeg_bytes);
        let data_url = format!("data:image/jpeg;base64,{}", encoded);
        let decoded = decode_image_data(&data_url).unwrap();
        assert_eq!(decoded.content_type, "image/jpeg");
        assert_eq!(decoded.bytes, jpeg_bytes);
    }

    #[test]
    fn decode_plain_base64_defaults_png() {
        let png_bytes = b"png";
        let encoded = base64::engine::general_purpose::STANDARD.encode(png_bytes);
        let decoded = decode_image_data(&encoded).unwrap();
        assert_eq!(decoded.content_type, "image/png");
        assert_eq!(decoded.bytes, png_bytes);
    }

    #[test]
    fn parse_s3_marker() {
        let image_data = "od:s3|image/png|drawings/abc.png";
        let (mime, key) = parse_od_s3_marker(image_data).unwrap();
        assert_eq!(mime, "image/png");
        assert_eq!(key, "drawings/abc.png");
    }
}
