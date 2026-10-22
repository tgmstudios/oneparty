// WASAPI loopback capture helper: streams what a Windows playback (output) device is playing to stdout.
// Build: server/audiocap.mjs compiles this with the .NET Framework csc.exe that ships with Windows (no SDK/installs).
//   loopback.exe --list                      JSON: [{"id","name","default":bool}]
//   loopback.exe [--device <name part|id>] [--stereo]   stream: int32 sampleRate, int32 channels(1, or 2 with --stereo), then float32 frames (interleaved L,R when stereo), forever
// No packets arrive while nothing is playing, so silence is synthesised as zero frames to keep the stream real-time.
using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumeratorCom { }

[ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator {
    [PreserveSig] int EnumAudioEndpoints(int dataFlow, int stateMask, out IMMDeviceCollection devices);
    [PreserveSig] int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice device);
    [PreserveSig] int GetDevice([MarshalAs(UnmanagedType.LPWStr)] string id, out IMMDevice device);
    [PreserveSig] int RegisterEndpointNotificationCallback(IntPtr client);
    [PreserveSig] int UnregisterEndpointNotificationCallback(IntPtr client);
}
[ComImport, Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceCollection {
    [PreserveSig] int GetCount(out uint count);
    [PreserveSig] int Item(uint index, out IMMDevice device);
}
[ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice {
    [PreserveSig] int Activate(ref Guid iid, int clsCtx, IntPtr activationParams, [MarshalAs(UnmanagedType.IUnknown)] out object iface);
    [PreserveSig] int OpenPropertyStore(int access, out IPropertyStore props);
    [PreserveSig] int GetId([MarshalAs(UnmanagedType.LPWStr)] out string id);
    [PreserveSig] int GetState(out int state);
}
[StructLayout(LayoutKind.Sequential)] struct PROPERTYKEY { public Guid fmtid; public uint pid; }
[ComImport, Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IPropertyStore {
    [PreserveSig] int GetCount(out uint count);
    [PreserveSig] int GetAt(uint i, out PROPERTYKEY key);
    [PreserveSig] int GetValue(ref PROPERTYKEY key, IntPtr pv);
    [PreserveSig] int SetValue(ref PROPERTYKEY key, IntPtr pv);
    [PreserveSig] int Commit();
}
[ComImport, Guid("1CB9AD4C-DBFA-4C32-B178-C2F568A703B2"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioClient {
    [PreserveSig] int Initialize(int shareMode, int streamFlags, long bufferDuration, long periodicity, IntPtr format, IntPtr sessionGuid);
    [PreserveSig] int GetBufferSize(out uint frames);
    [PreserveSig] int GetStreamLatency(out long latency);
    [PreserveSig] int GetCurrentPadding(out uint padding);
    [PreserveSig] int IsFormatSupported(int shareMode, IntPtr format, out IntPtr closest);
    [PreserveSig] int GetMixFormat(out IntPtr format);
    [PreserveSig] int GetDevicePeriod(out long defaultPeriod, out long minimumPeriod);
    [PreserveSig] int Start();
    [PreserveSig] int Stop();
    [PreserveSig] int Reset();
    [PreserveSig] int SetEventHandle(IntPtr handle);
    [PreserveSig] int GetService(ref Guid iid, [MarshalAs(UnmanagedType.IUnknown)] out object service);
}
[ComImport, Guid("C8ADBD64-E71E-48A0-A4DE-185C395CD317"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioCaptureClient {
    [PreserveSig] int GetBuffer(out IntPtr data, out uint frames, out uint flags, out ulong devicePos, out ulong qpcPos);
    [PreserveSig] int ReleaseBuffer(uint frames);
    [PreserveSig] int GetNextPacketSize(out uint size);
}

static class Loopback {
    static string FriendlyName(IMMDevice d) {
        try {
            IPropertyStore ps; if (d.OpenPropertyStore(0, out ps) != 0) return "?";
            var key = new PROPERTYKEY { fmtid = new Guid("a45c254e-df1c-4efd-8020-67d146a850e0"), pid = 14 };
            IntPtr pv = Marshal.AllocHGlobal(24);
            for (int i = 0; i < 24; i++) Marshal.WriteByte(pv, i, 0);
            try { ps.GetValue(ref key, pv); IntPtr s = Marshal.ReadIntPtr(pv, 8); return s == IntPtr.Zero ? "?" : Marshal.PtrToStringUni(s); }
            finally { Marshal.FreeHGlobal(pv); }
        } catch { return "?"; }
    }
    static string J(string s) { return "\"" + s.Replace("\\", "\\\\").Replace("\"", "\\\"") + "\""; }

    static int Main(string[] args) {
        var en = (IMMDeviceEnumerator)new MMDeviceEnumeratorCom();
        IMMDevice defDev; en.GetDefaultAudioEndpoint(0, 0, out defDev);
        string defId; defDev.GetId(out defId);

        if (Array.IndexOf(args, "--list") >= 0) {
            IMMDeviceCollection col; en.EnumAudioEndpoints(0, 1, out col);
            uint n; col.GetCount(out n);
            var sb = new StringBuilder("[");
            for (uint i = 0; i < n; i++) {
                IMMDevice d; col.Item(i, out d); string id; d.GetId(out id);
                if (i > 0) sb.Append(',');
                sb.Append("{\"id\":" + J(id) + ",\"name\":" + J(FriendlyName(d)) + ",\"default\":" + (id == defId ? "true" : "false") + "}");
            }
            Console.Out.Write(sb.Append(']').ToString()); return 0;
        }

        IMMDevice dev = defDev; string want = null; bool stereo = Array.IndexOf(args, "--stereo") >= 0;
        for (int i = 0; i < args.Length - 1; i++) if (args[i] == "--device") want = args[i + 1];
        if (!string.IsNullOrEmpty(want)) {
            IMMDeviceCollection col; en.EnumAudioEndpoints(0, 1, out col);
            uint n; col.GetCount(out n);
            for (uint i = 0; i < n; i++) {
                IMMDevice d; col.Item(i, out d); string id; d.GetId(out id);
                if (id == want || FriendlyName(d).IndexOf(want, StringComparison.OrdinalIgnoreCase) >= 0) { dev = d; break; }
            }
        }

        object o; Guid iidClient = new Guid("1CB9AD4C-DBFA-4C32-B178-C2F568A703B2");
        if (dev.Activate(ref iidClient, 23, IntPtr.Zero, out o) != 0) { Console.Error.WriteLine("activate failed"); return 2; }
        var client = (IAudioClient)o;
        IntPtr fmt; client.GetMixFormat(out fmt);
        int tag = (ushort)Marshal.ReadInt16(fmt, 0), ch = Marshal.ReadInt16(fmt, 2), rate = Marshal.ReadInt32(fmt, 4), bits = Marshal.ReadInt16(fmt, 14);
        bool isFloat = bits == 32;   // shared-mode mix format is IEEE float on every Windows 10/11 endpoint in practice
        int hr = client.Initialize(0, 0x00020000 /* AUDCLNT_STREAMFLAGS_LOOPBACK */, 10000000L, 0, fmt, IntPtr.Zero);
        if (hr != 0) { Console.Error.WriteLine("initialize failed 0x" + hr.ToString("x")); return 3; }
        object so; Guid iidCap = new Guid("C8ADBD64-E71E-48A0-A4DE-185C395CD317");
        client.GetService(ref iidCap, out so);
        var cap = (IAudioCaptureClient)so;
        client.Start();

        var stdout = Console.OpenStandardOutput();
        var head = new byte[8]; BitConverter.GetBytes(rate).CopyTo(head, 0); BitConverter.GetBytes(stereo ? 2 : 1).CopyTo(head, 4);
        stdout.Write(head, 0, 8); stdout.Flush();

        var sw = Stopwatch.StartNew(); double lastOut = 0;
        try {
            while (true) {
                Thread.Sleep(8);
                uint pkt; cap.GetNextPacketSize(out pkt);
                while (pkt > 0) {
                    IntPtr data; uint frames, flags; ulong dp, qp;
                    cap.GetBuffer(out data, out frames, out flags, out dp, out qp);
                    int oc = stereo ? 2 : 1; var mono = new float[frames * oc];
                    if ((flags & 2) == 0) {   // 2 = AUDCLNT_BUFFERFLAGS_SILENT
                        if (isFloat) {
                            var tmp = new float[frames * ch]; Marshal.Copy(data, tmp, 0, tmp.Length);
                            if (stereo) { for (int f = 0; f < frames; f++) { mono[f * 2] = tmp[f * ch]; mono[f * 2 + 1] = tmp[f * ch + (ch > 1 ? 1 : 0)]; } }
                            else for (int f = 0; f < frames; f++) { float s = 0; for (int c = 0; c < ch; c++) s += tmp[f * ch + c]; mono[f] = s / ch; }
                        } else {
                            var tmp = new short[frames * ch]; Marshal.Copy(data, tmp, 0, tmp.Length);
                            if (stereo) { for (int f = 0; f < frames; f++) { mono[f * 2] = tmp[f * ch] / 32768f; mono[f * 2 + 1] = tmp[f * ch + (ch > 1 ? 1 : 0)] / 32768f; } }
                            else for (int f = 0; f < frames; f++) { float s = 0; for (int c = 0; c < ch; c++) s += tmp[f * ch + c]; mono[f] = s / ch / 32768f; }
                        }
                    }
                    cap.ReleaseBuffer(frames);
                    var bytes = new byte[mono.Length * 4]; Buffer.BlockCopy(mono, 0, bytes, 0, bytes.Length);
                    stdout.Write(bytes, 0, bytes.Length);
                    lastOut = sw.Elapsed.TotalSeconds;
                    cap.GetNextPacketSize(out pkt);
                }
                double now = sw.Elapsed.TotalSeconds;
                if (now - lastOut >= 0.02) {   // nothing is playing: emit real-time silence
                    int frames = (int)((now - lastOut) * rate); var z = new byte[frames * 4 * (stereo ? 2 : 1)];
                    stdout.Write(z, 0, z.Length); lastOut = now;
                }
                stdout.Flush();
            }
        } catch (IOException) { return 0; }   // node closed the pipe
    }
}
