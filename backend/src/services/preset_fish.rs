//! 预置 AI 鱼池 - 硬编码 10 条鱼的图片和元数据
//!
//! 游戏前 5 条 AI 鱼从此池中随机选择（不重复）

use once_cell::sync::Lazy;

/// 预置鱼数据结构
#[derive(Debug, Clone)]
pub struct PresetFish {
    pub id: u8,
    pub name: &'static str,
    pub description: &'static str,
    pub image_base64: &'static str,
}

/// 9 条预置鱼池
/// 图片来源: backend/test2/ 目录
pub static PRESET_FISH_POOL: Lazy<Vec<PresetFish>> = Lazy::new(|| {
    vec![
        PresetFish {
            id: 0,
            name: "稀疏红鱼",
            description: "稀疏填充的抽象红色鱼",
            image_base64: include_str!("fish_base64/fish_0.txt"),
        },
        PresetFish {
            id: 1,
            name: "稀疏绿鱼",
            description: "稀疏填充的抽象绿色鱼",
            image_base64: include_str!("fish_base64/fish_1.txt"),
        },
        PresetFish {
            id: 2,
            name: "彩色抽象鱼",
            description: "随机配色的抽象鱼儿",
            image_base64: include_str!("fish_base64/fish_2.txt"),
        },
        PresetFish {
            id: 3,
            name: "橙色极简鱼",
            description: "单笔画风格的橙色小鱼",
            image_base64: include_str!("fish_base64/fish_3.txt"),
        },
        PresetFish {
            id: 4,
            name: "红色极简鱼",
            description: "单笔画风格的红色小鱼",
            image_base64: include_str!("fish_base64/fish_4.txt"),
        },
        PresetFish {
            id: 5,
            name: "深红极简鱼",
            description: "单笔画风格的深红小鱼",
            image_base64: include_str!("fish_base64/fish_5.txt"),
        },
        PresetFish {
            id: 6,
            name: "绿色极简鱼",
            description: "单笔画风格的绿色小鱼",
            image_base64: include_str!("fish_base64/fish_6.txt"),
        },
        PresetFish {
            id: 7,
            name: "蓝色极简鱼",
            description: "单笔画风格的蓝色小鱼",
            image_base64: include_str!("fish_base64/fish_7.txt"),
        },
        PresetFish {
            id: 8,
            name: "黑色极简鱼",
            description: "单笔画风格的黑色小鱼",
            image_base64: include_str!("fish_base64/fish_8.txt"),
        },
    ]
});

/// 获取预置鱼总数
pub fn preset_fish_count() -> usize {
    PRESET_FISH_POOL.len()
}

/// 根据 ID 获取预置鱼
pub fn get_preset_fish(id: u8) -> Option<&'static PresetFish> {
    PRESET_FISH_POOL.iter().find(|f| f.id == id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_preset_fish_pool_size() {
        assert_eq!(preset_fish_count(), 9);
    }

    #[test]
    fn test_get_preset_fish() {
        let fish = get_preset_fish(0);
        assert!(fish.is_some());
        assert_eq!(fish.unwrap().name, "稀疏红鱼");
    }
}
