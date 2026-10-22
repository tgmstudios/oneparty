"""BrizLabs sensitivity and pixel count controls."""

from homeassistant.components.number import NumberEntity
from homeassistant.core import callback
from homeassistant.helpers.entity import DeviceInfo

from .const import DOMAIN


async def async_setup_entry(hass, entry, async_add_entities):
    device = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([BrizlabsNumber(device, entry, "sensitivity", 0, 100),
                        BrizlabsNumber(device, entry, "lightpixel_number_set", 1, 200)])


class BrizlabsNumber(NumberEntity):
    _attr_has_entity_name = True
    _attr_native_step = 1

    def __init__(self, device, entry, key, minimum, maximum):
        self.device = device
        self.key = key
        self._attr_name = "Music sensitivity" if key == "sensitivity" else "Pixel count"
        self._attr_unique_id = f"{device.address}_{key}"
        self._attr_native_min_value = minimum
        self._attr_native_max_value = maximum
        self._attr_device_info = DeviceInfo(identifiers={(DOMAIN, device.address)})

    async def async_added_to_hass(self):
        self.async_on_remove(self.device.subscribe(self._changed))

    @callback
    def _changed(self):
        self.async_write_ha_state()

    @property
    def available(self):
        return self.device.available and self.key in self.device.values

    @property
    def native_value(self):
        return self.device.values.get(self.key)

    async def async_set_native_value(self, value):
        await self.device.send({self.key: int(value)})
