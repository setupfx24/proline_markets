"""Whether to use Infoway WebSocket vs simulated feed."""


def usable_infoway_api_key(key: str | None) -> bool:
    """True if key looks like a real Infoway credential (not empty / tutorial text)."""
    if key is None:
        return False
    k = str(key).strip()
    if len(k) < 12:
        return False
    low = k.lower()
    for bad in (
        "placeholder",
        "your-infoway",
        "your_infoway",
        "example",
        "changeme",
        "change_me",
        "xxx",
        "todo",
        "dev-placeholder",
    ):
        if bad in low:
            return False
    if low in ("test", "none", "null", "false"):
        return False
    return True
