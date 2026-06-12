from enum import Enum


class NotificationEvent(str, Enum):
    private_booking_submitted = "private_booking_submitted"
    private_booking_reviewed = "private_booking_reviewed"
    payment_succeeded = "payment_succeeded"
    payment_failed = "payment_failed"
    refund_succeeded = "refund_succeeded"
    refund_failed = "refund_failed"
    screening_confirmed = "screening_confirmed"
    screening_cancelled = "screening_cancelled"
    movie_request_arrived_in_campaign = "movie_request_arrived_in_campaign"


class NotificationTemplate(str, Enum):
    private_booking_submitted_audience = "private_booking_submitted_audience"
    private_booking_submitted_cinema = "private_booking_submitted_cinema"
    private_booking_reviewed_audience = "private_booking_reviewed_audience"
    payment_succeeded = "payment_succeeded"
    payment_failed = "payment_failed"
    refund_succeeded = "refund_succeeded"
    refund_failed = "refund_failed"
    screening_confirmed = "screening_confirmed"
    screening_cancelled = "screening_cancelled"
    movie_request_arrived_in_campaign = "movie_request_arrived_in_campaign"


class DeliveryErrorKind(str, Enum):
    transient = "transient"
    permanent = "permanent"


DEFAULT_MAX_ATTEMPTS = 5
DEFAULT_BATCH_SIZE = 20
DEFAULT_POLL_INTERVAL_SECONDS = 10
