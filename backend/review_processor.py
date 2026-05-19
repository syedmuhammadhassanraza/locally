def process_review(provider_id: str, rating: float, review_text: str, db_mock=None) -> dict:
    """
    Process a review and flag it for human moderation if it's anomalously low
    for a high-performing provider.
    """
    
    # Simulate fetching history
    if db_mock:
        history = db_mock.get_provider_history(provider_id)
        if history and history.get("total_reviews", 0) > 0:
            success_rate = history["positive_reviews"] / history["total_reviews"]
        else:
            success_rate = 0.5
    else:
        success_rate = 0.85  # mock default

    flagged = False
    reason = None
    
    # Anomaly detection logic
    if rating < 3.0 and success_rate >= 0.80:
        flagged = True
        reason = f"Anomaly: Low rating ({rating}) for a high-performing provider (success rate: {int(success_rate*100)}%)."

    if db_mock:
        db_mock.update_rating(provider_id, rating)

    return {
        "provider_id": provider_id,
        "rating": rating,
        "review_text": review_text,
        "flagged_for_moderation": flagged,
        "reason": reason
    }
