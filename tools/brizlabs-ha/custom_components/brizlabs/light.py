"""Light entity with RGB, brightness, Flow scene, and segmented painting."""

from homeassistant.components.light import ATTR_BRIGHTNESS, ATTR_EFFECT, ATTR_HS_COLOR, ColorMode, LightEntity, LightEntityFeature
from homeassistant.core import callback
from homeassistant.helpers.entity import DeviceInfo

from .const import DOMAIN, FLOW_SCENE


def paint_colour(hue, saturation, value, segments=(), count=0):
    """Tuya strip smear data: version/mode/effect/count/action/HSV/selection."""
    hue = round(hue) % 360
    sat = max(0, min(1000, round(saturation * 10)))
    val = max(0, min(1000, round(value * 10)))
    action = 1 if segments else 0
    result = f"000100{count:02x}{action:02x}{hue:04x}{sat:04x}{val:04x}"
    if segments:
        chosen = sorted(set(int(x) for x in segments))
        if not chosen or any(x < 0 or x >= count for x in chosen) or len(chosen) > 127:
            raise ValueError("Segments must be zero-based indices within the configured count")
        result += f"{(128 + len(chosen)):02x}" + "".join(f"{x + 1:02x}" for x in chosen)
    return result


async def async_setup_entry(hass, entry, async_add_entities):
    async_add_entities([BrizlabsLight(hass.data[DOMAIN][entry.entry_id], entry)])


class BrizlabsLight(LightEntity):
    _attr_has_entity_name = True
    _attr_name = None
    _attr_supported_color_modes = {ColorMode.HS}
    _attr_color_mode = ColorMode.HS
    _attr_effect_list = ["Flow", "Music"]
    _attr_supported_features = LightEntityFeature.EFFECT

    def __init__(self, device, entry):
        self.device = device
        self._attr_unique_id = device.address.replace(":", "").lower()
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, device.address)},
            name=entry.title,
            manufacturer="BrizLabs",
            model="Micro String Lights",
            connections={("bluetooth", device.address)},
        )

    async def async_added_to_hass(self):
        self.async_on_remove(self.device.subscribe(self._changed))

    @callback
    def _changed(self):
        self.async_write_ha_state()

    @property
    def available(self):
        return self.device.available

    @property
    def is_on(self):
        return bool(self.device.values.get("switch_led", False))

    @property
    def brightness(self):
        return round(int(self.device.values.get("bright_value", 100)) * 255 / 100)

    @property
    def effect(self):
        mode = self.device.values.get("work_mode")
        if mode == "scene":
            return "Flow"
        if mode == "music":
            return "Music"
        return None

    @property
    def hs_color(self):
        value = self.device.values.get("paint_colour_data", "")
        if len(value) >= 22 and value[:4] == "0001":
            try:
                return (int(value[10:14], 16), int(value[14:18], 16) / 10)
            except ValueError:
                pass
        return (0, 100)

    @property
    def extra_state_attributes(self):
        return {"light_pixel": self.device.values.get("light_pixel"),
                "work_mode": self.device.values.get("work_mode"),
                "device_music": self.device.values.get("device_music"),
                "scene_data": self.device.values.get("dreamlight_scene_mode")}

    async def async_turn_on(self, **kwargs):
        data = {"switch_led": True}
        if ATTR_BRIGHTNESS in kwargs:
            data["bright_value"] = max(1, min(100, round(kwargs[ATTR_BRIGHTNESS] * 100 / 255)))
        if ATTR_HS_COLOR in kwargs:
            hue, saturation = kwargs[ATTR_HS_COLOR]
            data["work_mode"] = "colour"
            data["paint_colour_data"] = paint_colour(hue, saturation, 100)
        elif ATTR_EFFECT in kwargs:
            if kwargs[ATTR_EFFECT] == "Flow":
                data["work_mode"] = "scene"
                data["dreamlight_scene_mode"] = FLOW_SCENE
            elif kwargs[ATTR_EFFECT] == "Music":
                data["work_mode"] = "music"
                data["device_music"] = 7
            else:
                raise ValueError(f"Unsupported effect: {kwargs[ATTR_EFFECT]}")
        await self.device.send(data)

    async def async_turn_off(self, **kwargs):
        await self.device.send({"switch_led": False})
