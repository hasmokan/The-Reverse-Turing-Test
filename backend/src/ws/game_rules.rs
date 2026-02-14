pub fn clamp_ratio(r: f64) -> f64 {
    r.clamp(0.0, 1.0)
}

pub fn ceil_ratio(total: i64, ratio: f64) -> i64 {
    ((total as f64) * clamp_ratio(ratio)).ceil() as i64
}

pub fn human_eliminated_limit(human_total: i64, ratio: f64) -> i64 {
    std::cmp::max(1, ceil_ratio(human_total, ratio))
}

pub fn min_human_survive(human_total: i64, ratio: f64) -> i64 {
    std::cmp::max(1, ceil_ratio(human_total, ratio))
}

pub fn ai_overflow(ai_alive: i64, human_alive: i64, delta: i64) -> bool {
    let delta = delta.max(0);
    ai_alive > human_alive + delta
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_human_eliminated_limit_small_room() {
        assert_eq!(human_eliminated_limit(1, 0.4), 1);
        assert_eq!(human_eliminated_limit(2, 0.4), 1);
        assert_eq!(human_eliminated_limit(3, 0.4), 2);
        assert_eq!(human_eliminated_limit(5, 0.4), 2);
    }

    #[test]
    fn test_min_human_survive_small_room() {
        assert_eq!(min_human_survive(1, 0.6), 1);
        assert_eq!(min_human_survive(2, 0.6), 2);
        assert_eq!(min_human_survive(3, 0.6), 2);
        assert_eq!(min_human_survive(5, 0.6), 3);
    }

    #[test]
    fn test_ai_overflow_delta() {
        assert!(!ai_overflow(1, 1, 2));
        assert!(!ai_overflow(3, 1, 2));
        assert!(ai_overflow(4, 1, 2));
    }
}
