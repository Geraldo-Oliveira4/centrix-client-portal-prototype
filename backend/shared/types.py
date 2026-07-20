from enum import Enum


class TestEnum(str, Enum):
    TEST = "test"

    @classmethod
    def from_string(cls, value):
        try:
            return cls(value.upper())
        except (ValueError, AttributeError):
            return cls.NOT_CALLED
