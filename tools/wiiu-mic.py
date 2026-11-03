"""Wii U mic -> Voicemeeter, surviving Windows' unplug/replug.

The Wii U mic ("Microphone (WUP-021-0)") shows up in Windows as a normal capture endpoint, but each time it is powered off Windows
marks the endpoint unplugged, and apps that had it selected lose it. This keeps it routed through Voicemeeter instead:

    Wii U mic  ->  Voicemeeter hardware strip 1  ->  bus B1  ->  "Voicemeeter Out B1" (a virtual mic that never disconnects)

Pick "Voicemeeter Out B1" as the microphone in Discord / OBS / browsers / the hub. This watcher polls the endpoint's state in the registry
and, whenever the mic comes back, re-binds the strip and restarts the Voicemeeter audio engine so audio flows again.

Run:  pythonw tools/wiiu-mic.py            (keeps running; a logon scheduled task starts it)
      python tools/wiiu-mic.py --once      (bind now and exit)
      python tools/wiiu-mic.py --status    (print what it sees)
"""
import ctypes, json, os, subprocess, sys, time, urllib.request, winreg

DEVICE_MATCH = 'WUP-021'                 # substring of the endpoint's name
WDM_NAME = 'Microphone (WUP-021-0)'      # Voicemeeter wants the endpoint's friendly name
STRIP = 0                                # hardware input strip 1
BUS = 'B1'                               # virtual output the rest of Windows records from
MONITOR_BUS, MONITOR_WDM = 'A1', 'Headphones (Realtek(R) Audio)'   # sidetone: you hear the mic in these headphones (opened via MME/shared mode) (set MONITOR_WDM = None to turn off)
VM_DIR = r'C:\Program Files (x86)\VB\Voicemeeter'
VM_EXE = os.path.join(VM_DIR, 'voicemeeterpro_x64.exe')
HUB = 'http://127.0.0.1:8787'
DUCK_TO = 0.30                           # music volume while the mic is on, as a fraction of what it was (0.30 = 30%)
DUCK_FILE = os.path.join(os.environ.get('TEMP', '.'), 'wiiu-mic-duck.json')   # remembers the pre-duck volume across watcher restarts
LOG = os.path.join(os.environ.get('TEMP', '.'), 'wiiu-mic.log')

def log(*a):
    line = time.strftime('%H:%M:%S ') + ' '.join(str(x) for x in a)
    try:
        with open(LOG, 'a', encoding='utf-8') as f: f.write(line + '\n')
    except OSError: pass
    if sys.stdout: print(line, flush=True)

def mic_state():
    """DeviceState of the Wii U mic capture endpoint: 1 = active, 2 = disabled, 4 = not present, 8 = unplugged, None = never seen"""
    root = r'SOFTWARE\Microsoft\Windows\CurrentVersion\MMDevices\Audio\Capture'
    best = None
    with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, root) as k:
        for i in range(winreg.QueryInfoKey(k)[0]):
            guid = winreg.EnumKey(k, i)
            try:
                with winreg.OpenKey(k, guid + r'\Properties') as p:
                    names = []
                    for j in range(winreg.QueryInfoKey(p)[1]):
                        _, v, _ = winreg.EnumValue(p, j)
                        if isinstance(v, str): names.append(v)
                if not any(DEVICE_MATCH in n for n in names): continue
                with winreg.OpenKey(k, guid) as e: st = winreg.QueryValueEx(e, 'DeviceState')[0]
                if best is None or st == 1: best = st
            except OSError: continue
    return best

def hub(cmd=None):
    """GET the hub state, or POST a command ({type:...})"""
    req = urllib.request.Request(HUB + ('/api/cmd' if cmd else '/api/state'), data=json.dumps(cmd).encode() if cmd else None, headers={'content-type': 'application/json'})
    with urllib.request.urlopen(req, timeout=4) as r: return json.loads(r.read() or b'null')

def duck(on):
    """lower Spotify while the mic is on, put it back when it goes away"""
    try:
        if on:
            if os.path.exists(DUCK_FILE): return   # already ducked
            v = (hub().get('track') or {}).get('volume')
            if v is None: return
            with open(DUCK_FILE, 'w') as f: json.dump({'volume': v}, f)
            hub({'type': 'player', 'action': 'volume', 'percent': max(3, round(v * DUCK_TO))}); log('ducked music', v, '->', max(3, round(v * DUCK_TO)))
        elif os.path.exists(DUCK_FILE):
            with open(DUCK_FILE) as f: v = json.load(f)['volume']
            hub({'type': 'player', 'action': 'volume', 'percent': v}); os.remove(DUCK_FILE); log('restored music volume', v)
    except Exception as e: log('duck:', e)

class VM:
    def __init__(self):
        self.d = ctypes.WinDLL(os.path.join(VM_DIR, 'VoicemeeterRemote64.dll'))
        self.d.VBVMR_Login.restype = ctypes.c_long
        self.on = False
    def login(self):
        if self.on: return True
        r = self.d.VBVMR_Login()
        if r == 1 and not self.running():   # 1 = Voicemeeter not running: start it
            subprocess.Popen([VM_EXE]); time.sleep(5); r = self.d.VBVMR_Login()
        self.on = r == 0
        return self.on
    @staticmethod
    def running():
        return b'voicemeeterpro_x64' in subprocess.run(['tasklist'], capture_output=True, creationflags=0x08000000).stdout.lower()
    def logout(self):
        if self.on: self.d.VBVMR_Logout(); self.on = False
    def set(self, param, value):
        if isinstance(value, str): return self.d.VBVMR_SetParameterStringW(param.encode(), value)   # the API wants the parameter NAME as ANSI bytes
        return self.d.VBVMR_SetParameterFloat(param.encode(), ctypes.c_float(value))
    def get_s(self, param):
        b = ctypes.create_unicode_buffer(512); self.d.VBVMR_IsParametersDirty(); self.d.VBVMR_GetParameterStringW(param.encode(), b); return b.value
    def get_f(self, param):
        v = ctypes.c_float(); self.d.VBVMR_IsParametersDirty(); self.d.VBVMR_GetParameterFloat(param.encode(), ctypes.byref(v)); return v.value

def bind(vm):
    """point the strip at the Wii U mic, route it only to B1, and restart the audio engine"""
    if not vm.login(): log('cannot reach Voicemeeter'); return False
    vm.set(f'Strip[{STRIP}].device.wdm', WDM_NAME)
    vm.set(f'Strip[{STRIP}].Mute', 0.0); vm.set(f'Strip[{STRIP}].Mono', 1.0)   # the Wii U mic is a mono capsule
    if MONITOR_WDM: vm.set(f'Bus[{int(MONITOR_BUS[1]) - 1}].device.mme', MONITOR_WDM)   # MME = shared mode. WDM would lock the headphones exclusively and Spotify then says "can't play this right now"
    for b in ('A1', 'A2', 'A3', 'B1', 'B2'): vm.set(f'Strip[{STRIP}].{b}', 1.0 if b in (BUS, MONITOR_BUS if MONITOR_WDM else None) else 0.0)   # B1 for apps; the headphones bus only for monitoring
    vm.set('Command.Restart', 1.0); time.sleep(3)
    got = ''
    for _ in range(8):   # the read-back lags the write by a moment
        got = vm.get_s(f'Strip[{STRIP}].device.name')
        if got: break
        time.sleep(0.5)
    log('bound strip', STRIP + 1, '->', repr(got), '| route', BUS, vm.get_f(f'Strip[{STRIP}].{BUS}'), MONITOR_BUS, vm.get_f(f'Strip[{STRIP}].{MONITOR_BUS}'), '| monitor ->', repr(vm.get_s(f'Bus[{int(MONITOR_BUS[1]) - 1}].device.name')))
    return DEVICE_MATCH in (got or '')

def main():
    if '--status' in sys.argv:
        print('endpoint state:', mic_state(), '(1=active 4=not present 8=unplugged)')
        vm = VM(); print('voicemeeter login:', vm.login()); print('strip device:', repr(vm.get_s(f'Strip[{STRIP}].device.name'))); return
    if '--once' in sys.argv:
        sys.exit(0 if bind(VM()) else 1)
    vm, last = VM(), None
    log('watching the Wii U mic; recording from "Voicemeeter Out B1"')
    if mic_state() != 1: duck(False)   # a ducked volume left over from before a restart
    try: vm.login()   # keep Voicemeeter itself up so "Voicemeeter Out B1" always carries audio (silence while the mic is off)
    except Exception as e: log('voicemeeter start:', e)
    while True:
        try:
            st = mic_state()
            if st != last:
                log('mic endpoint state', last, '->', st, '(1=active)')
                duck(st == 1)
                if st == 1:
                    time.sleep(1.5)   # let the driver finish enumerating
                    for _ in range(3):
                        if bind(vm): break
                        time.sleep(2)
                last = st
            elif st == 1 and not vm.running():   # Voicemeeter was closed: bring it back
                vm.on = False; bind(vm)
        except Exception as e:
            log('error:', e); vm.on = False
        time.sleep(2)

if __name__ == '__main__':
    main()
