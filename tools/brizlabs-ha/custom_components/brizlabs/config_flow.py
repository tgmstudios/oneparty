import re

import voluptuous as vol
from homeassistant import config_entries

from .const import DOMAIN


class BrizlabsConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input=None):
        errors = {}
        if user_input is not None:
            address = user_input["address"].upper().replace("-", ":")
            if not re.fullmatch(r"(?:[0-9A-F]{2}:){5}[0-9A-F]{2}", address):
                errors["address"] = "invalid_address"
            else:
                await self.async_set_unique_id(address)
                self._abort_if_unique_id_configured()
                return self.async_create_entry(title=user_input["name"], data={"address": address})
        schema = vol.Schema({vol.Required("address"): str, vol.Required("name", default="BrizLabs Micro String Lights"): str})
        return self.async_show_form(step_id="user", data_schema=schema, errors=errors)
