import json
from aiokafka import AIOKafkaProducer, AIOKafkaConsumer
from .config import get_settings

settings = get_settings()


class KafkaTopics:
    ORDERS = "orders"
    TRADES = "trades"
    POSITIONS = "positions"
    DEPOSITS = "deposits"
    WITHDRAWALS = "withdrawals"
    COMMISSIONS = "commissions"
    NOTIFICATIONS = "notifications"
    AUDIT = "audit"
    MARKET_DATA = "market_data"
    RISK_EVENTS = "risk_events"
    SOCIAL_COPY = "social_copy"


_producer = None


async def get_kafka_producer() -> AIOKafkaProducer:
    global _producer
    if _producer is None:
        _producer = AIOKafkaProducer(
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
            value_serializer=lambda v: json.dumps(v).encode("utf-8"),
            key_serializer=lambda k: k.encode("utf-8") if k else None,
        )
        await _producer.start()
    return _producer


async def produce_event(topic: str, key: str, value: dict):
    producer = await get_kafka_producer()
    await producer.send_and_wait(topic, key=key, value=value)


def create_consumer(topic: str, group_id: str) -> AIOKafkaConsumer:
    return AIOKafkaConsumer(
        topic,
        bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
        group_id=group_id,
        value_deserializer=lambda v: json.loads(v.decode("utf-8")),
        auto_offset_reset="latest",
        enable_auto_commit=True,
    )


async def close_producer():
    global _producer
    if _producer:
        await _producer.stop()
        _producer = None
