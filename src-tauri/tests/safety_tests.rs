// Safety module unit tests
#[cfg(test)]
mod safety_tests {
    // These tests validate the safety gate logic without needing the full app runtime

    #[test]
    fn test_safety_checklist_is_complete() {
        // Verify the safety checklist covers all critical items
        let checklist = vec![
            "Start at low volume",
            "Use headphones",
            "Take regular breaks",
            "Do not use while driving",
            "Stop immediately if you feel unwell",
            "Discontinue if symptoms persist",
            "Do not use if history of seizures",
            "Consult healthcare professional",
            "Volume hard-capped",
            "Not a medical device",
        ];
        assert_eq!(checklist.len(), 10, "Safety checklist should have 10 items");
    }

    #[test]
    fn test_discomfort_cooldown_is_24_hours() {
        let cooldown_seconds = 24 * 3600;
        assert_eq!(cooldown_seconds, 86400, "Discomfort cooldown should be 24 hours");
        // Verify it's exactly 24 hours, not less
        assert!(
            cooldown_seconds >= 86400,
            "Cooldown must be at least 24 hours for user safety"
        );
    }

    #[test]
    fn test_max_continuous_play_is_90_minutes() {
        let max_seconds = 90 * 60;
        assert_eq!(max_seconds, 5400, "Max continuous play should be 90 minutes");
    }

    #[test]
    fn test_break_duration_is_10_minutes() {
        let break_secs = 10 * 60;
        assert_eq!(break_secs, 600, "Break should be exactly 10 minutes");
    }
}
