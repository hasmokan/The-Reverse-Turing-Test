use base64::Engine;
use sqlx::PgPool;
use uuid::Uuid;

use crate::services::ApiError;

pub struct ImageBytes {
    pub content_type: &'static str,
    pub bytes: Vec<u8>,
}

#[async_trait::async_trait]
pub trait ImageStore: Send + Sync {
    async fn get_drawing_image(
        &self,
        db: &PgPool,
        drawing_id: Uuid,
    ) -> Result<ImageBytes, ApiError>;
}

pub struct DbDataUrlImageStore;

fn decode_image_data(image_data: &str) -> Result<ImageBytes, ApiError> {
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

#[async_trait::async_trait]
impl ImageStore for DbDataUrlImageStore {
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
}
