# Homebridge ESPHome Doorbell

This is a Homebridge platform plugin to be used with the ($2 doorbell from Frenck)[https://frenck.dev/diy-smart-doorbell-for-just-2-dollar/].
It is a work in progress.

## Getting Started

```json
{
    "platform": "esphome-doorbell",
    "devices": [
        {
            "host": "doorbell.local",
            "password": "Passw0rd!",
            "name": "Doorbell",
            "port": 9001
        }
    ]
}
```

Only the `host` key is mandatory under devices. As password `''` is assumed aka no password and the default
port number 80 is also wired into the plugin. You can add, in theory, as many doorbells as you want to
that array, as long as you provide a unique name for each.

## Todo
[ ] Add a way to toggle the chime
