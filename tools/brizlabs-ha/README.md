# BrizLabs Micro String Lights for Home Assistant

This custom integration controls the two RY micro string light sets through the Raspberry Pi's local Bluetooth adapter. It uses the observed BrizLabs GATT framing and property messages. It does not require the BrizLabs cloud or the reported Wi-Fi addresses.

## Installed devices

| Home Assistant light | Bluetooth address | Wi-Fi address |
| --- | --- | --- |
| `light.brizlabs_micro_string_lights_1` | `44:4A:D6:0C:96:0F` | `192.168.8.160` |
| `light.brizlabs_micro_string_lights_2` | `44:4A:D6:0C:7F:52` | `192.168.8.150` |

The supplied Wi-Fi MAC `44:4A:D6:0C:96:0E` belongs to light 1. Its Bluetooth address ends in `0F`. The supplied `10.42.4.0` address is part of the Pi's Kubernetes pod network, not the light's current LAN address.

## Controls

- Each light has power, brightness, hue/saturation, a captured **Flow** effect, and a verified **Music** mode.
- Each device has a music sensitivity number and a pixel count number. The devices reported 200 pixels.
- `brizlabs.paint_segments` paints selected zero-based sections with a hue, saturation, and value. The default 20-section mapping follows the strip panel's format. The command was accepted and the device switched to colour mode; the physical section mapping still needs visual confirmation.
- `brizlabs.set_properties` sends native property values for advanced modes and additional scenes. Example:

```yaml
action: brizlabs.set_properties
data:
  address: "44:4A:D6:0C:96:0F"
  properties:
    work_mode: scene
    dreamlight_scene_mode: "00010232000003e803e800000000"
```

The app may compete with Home Assistant for the Bluetooth connection. Fully close it during normal Home Assistant control. The integration retries disconnected lights.

## Files and deployment

Copy `custom_components/brizlabs` into Home Assistant's persistent `/config/custom_components/` directory and restart Home Assistant. Add one integration entry per Bluetooth address through Settings → Devices & services → Add integration → BrizLabs Micro String Lights.

On this Pi, Home Assistant runs in Kubernetes. Helm chart `home-assistant` version `0.3.74` is configured with an `additionalVolumes` hostPath for `/run/dbus` and a matching `additionalMounts` entry at `/run/dbus`, giving the pod access to the host Bluetooth service. The integration files live on the Home Assistant persistent config volume. If the Helm release is re-created, preserve those two values.

The framing, power, colour, Flow, and Music property payloads were observed from this model. Other named app effects and the meaning of each `device_music` value have not yet been mapped, so they are available through the native properties service only after their values are captured.
