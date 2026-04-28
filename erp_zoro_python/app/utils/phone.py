from __future__ import annotations


def format_phone(raw: object) -> str | None:
    if raw is None:
        return None

    value = str(raw).strip()
    if not value:
        return None

    has_plus = value.startswith("+")
    digits = "".join(char for char in value if char.isdigit())
    if not digits:
        return None

    if len(digits) > 10:
        country = digits[: len(digits) - 10]
        rest = digits[-10:]
        rest_fmt = f"{rest[:3]}-{rest[3:6]}-{rest[6:]}"
        prefix = "+" if has_plus else ""
        return f"{prefix}{country} {rest_fmt}"

    if len(digits) == 10:
        prefix = "+" if has_plus else ""
        return f"{prefix}{digits[:3]}-{digits[3:6]}-{digits[6:]}"

    if len(digits) == 9:
        return f"{digits[:3]}-{digits[3:6]}-{digits[6:]}"

    if len(digits) == 8:
        return f"{digits[:4]}-{digits[4:]}"

    if len(digits) == 7:
        return f"{digits[:3]}-{digits[3:]}"

    parts = [digits[index : index + 3] for index in range(0, len(digits), 3)]
    return "-".join(parts)
