"""Turn on a Kasa switch ~2 hours before snow starts in Brooklyn, NY 11204.

Reads the National Weather Service hourly forecast. If snow is forecast to
start within LEAD_HOURS, it fires an IFTTT Webhooks event; an IFTTT applet
("If Webhooks event snow_coming, then Kasa: turn on <switch>") flips the switch.

Env vars:
  IFTTT_WEBHOOK_KEY  required to actually fire (otherwise dry run)
  IFTTT_EVENT        default "snow_coming"
  LEAD_HOURS         default 2
  MIN_POP            minimum chance of precipitation, percent (default 40)
  LAT / LON          default 40.6188 / -73.9846 (zip 11204, Bensonhurst)

Writes `fired=true|false` and `snow_start=<iso time>` to $GITHUB_OUTPUT so the
workflow can remember which snow event it already handled.
"""
import json
import os
import re
import sys
import urllib.request
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

LAT = os.environ.get("LAT", "40.6188")
LON = os.environ.get("LON", "-73.9846")
LEAD_HOURS = float(os.environ.get("LEAD_HOURS", "2"))
MIN_POP = int(os.environ.get("MIN_POP", "40"))
EVENT = os.environ.get("IFTTT_EVENT", "snow_coming")
KEY = os.environ.get("IFTTT_WEBHOOK_KEY", "")
ALREADY_FIRED_FOR = os.environ.get("ALREADY_FIRED_FOR", "")

SNOW_WORDS = re.compile(r"snow|flurr|sleet|wintry|ice pellets", re.I)
HEADERS = {"User-Agent": "kasa-snow-switch (github actions)", "Accept": "application/geo+json"}


def get_json(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.load(resp)


def is_snow(period):
    pop = (period.get("probabilityOfPrecipitation") or {}).get("value") or 0
    return bool(SNOW_WORDS.search(period.get("shortForecast", ""))) and pop >= MIN_POP


def find_snow_start(periods, now):
    """Start time of the current/next snow spell, or None if no snow is forecast."""
    for p in periods:
        end = datetime.fromisoformat(p["endTime"])
        if end <= now:
            continue
        if is_snow(p):
            return datetime.fromisoformat(p["startTime"]), p
    return None, None


def fire():
    url = f"https://maker.ifttt.com/trigger/{EVENT}/with/key/{KEY}"
    req = urllib.request.Request(url, data=b"{}", method="POST",
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.status


def write_output(**kv):
    path = os.environ.get("GITHUB_OUTPUT")
    if path:
        with open(path, "a") as f:
            for k, v in kv.items():
                f.write(f"{k}={v}\n")


def main():
    now = datetime.now(timezone.utc)
    point = get_json(f"https://api.weather.gov/points/{LAT},{LON}")
    periods = get_json(point["properties"]["forecastHourly"])["properties"]["periods"]

    start, period = find_snow_start(periods, now)
    if start is None:
        print("No snow in the forecast.")
        write_output(fired="false", snow_start="")
        return

    hours_away = (start - now).total_seconds() / 3600
    print(f"Next snow: {start.isoformat()} ({hours_away:.1f}h away) - "
          f"{period['shortForecast']}, {period['probabilityOfPrecipitation']['value']}% chance")

    if hours_away > LEAD_HOURS:
        print(f"More than {LEAD_HOURS:g}h away, waiting.")
        write_output(fired="false", snow_start="")
        return

    # One switch-on per snow day (New York time), so a refreshed forecast that
    # nudges the start time, or you turning the switch off, doesn't re-fire it.
    event_id = start.astimezone(ZoneInfo("America/New_York")).strftime("%Y%m%d")
    if ALREADY_FIRED_FOR and ALREADY_FIRED_FOR == event_id:
        print("Already turned the switch on for this snow event.")
        write_output(fired="false", snow_start=event_id)
        return

    if not KEY:
        print("DRY RUN: would turn the switch on now (set IFTTT_WEBHOOK_KEY to enable).")
        write_output(fired="false", snow_start=event_id)
        return

    status = fire()
    print(f"Fired IFTTT event '{EVENT}' (HTTP {status}) - switch turning on.")
    write_output(fired="true", snow_start=event_id)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
