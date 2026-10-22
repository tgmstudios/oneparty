// Which addresses can other devices use to reach this hub? Lists the machine's IPv4 addresses, best guess first.
import os from 'node:os';
import dgram from 'node:dgram';

const VIRTUAL = /vethernet|wsl|hyper-v|virtual|vmware|vbox|virtualbox|docker|bluetooth|loopback|tailscale|zerotier|wireguard|vpn|tgm-|ccso|home-internal/i;
const isPrivate = ip => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);

// The local address the OS would use to reach `host` (no packet is sent): the one HA can reach us on, even with several adapters.
export function addressToward(host, port = 8123) {
  return new Promise(resolve => {
    const s = dgram.createSocket('udp4'), done = v => { try { s.close(); } catch {} resolve(v); };
    s.on('error', () => done(''));
    s.connect(+port || 8123, host, () => { try { done(s.address().address); } catch { done(''); } });
  });
}

export function lanUrls(port) {
  const out = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family !== 'IPv4' || a.internal || a.address.startsWith('169.254.')) continue;
      const virtual = VIRTUAL.test(name);
      // Wi-Fi / Ethernet on a home-style subnet first; VPN-ish and virtual adapters last (a Surface on the Wi-Fi can't reach those)
      const rank = (virtual ? 10 : 0) + (isPrivate(a.address) ? 0 : 5) + (/wi-?fi|wlan|wireless/i.test(name) ? 0 : /ethernet/i.test(name) ? 1 : 2);
      out.push({ url: `http://${a.address}:${port}`, ip: a.address, iface: name, virtual, rank });
    }
  }
  return out.sort((x, y) => x.rank - y.rank).map(({ rank, ...r }) => r);
}
