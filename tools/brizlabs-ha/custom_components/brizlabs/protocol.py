"""Framing observed on the BrizLabs RY Bluetooth GATT service."""

import json


def encode(message: dict) -> list[bytes]:
    payload = json.dumps(message, separators=(",", ":"), ensure_ascii=False).encode()
    chunks = [payload[i:i + 118] for i in range(0, len(payload), 118)]
    packets = []
    for index, chunk in enumerate(chunks):
        body = (b"\x01" + index.to_bytes(2, "big") + len(chunks).to_bytes(2, "big")
                + len(payload).to_bytes(2, "big") + bytes([len(chunk)]) + chunk)
        packets.append(b"\xff" + body + bytes([sum(body) & 255]))
    return packets


class Decoder:
    def __init__(self):
        self.parts = {}
        self.total = 0
        self.length = 0

    def feed(self, packet: bytes) -> dict | None:
        if len(packet) < 10 or packet[0] != 255 or packet[1] != 1:
            return None
        if sum(packet[1:-1]) & 255 != packet[-1]:
            return None
        index = int.from_bytes(packet[2:4], "big")
        total = int.from_bytes(packet[4:6], "big")
        length = int.from_bytes(packet[6:8], "big")
        size = packet[8]
        if total < 1 or total > 100 or index >= total or len(packet) != size + 10:
            return None
        if index == 0:
            self.parts = {}
            self.total = total
            self.length = length
        if total != self.total or length != self.length:
            return None
        self.parts[index] = packet[9:-1]
        if len(self.parts) != total:
            return None
        payload = b"".join(self.parts[i] for i in range(total))
        self.parts = {}
        if len(payload) != length:
            return None
        try:
            return json.loads(payload)
        except (ValueError, UnicodeDecodeError):
            return None
