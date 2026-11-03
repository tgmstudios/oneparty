# Show or set the Windows default recording device (all roles).  Usage:
#   powershell -File tools\default-mic.ps1                      -> list capture devices and the current default
#   powershell -File tools\default-mic.ps1 "Voicemeeter Out B1" -> make that device the default (console + communications + multimedia)
param([string]$Name)
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices;
[ComImport, Guid("870af99c-171d-4f9e-af0d-e63df40c2bc9")] class PolicyConfigClient {}
[Guid("f8679f50-850a-41cf-9c72-430f290290c8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IPolicyConfig {
  int GetMixFormat(); int GetDeviceFormat(); int ResetDeviceFormat(); int SetDeviceFormat(); int GetProcessingPeriod(); int SetProcessingPeriod();
  int GetShareMode(); int SetShareMode(); int GetPropertyValue(); int SetPropertyValue();
  [PreserveSig] int SetDefaultEndpoint([MarshalAs(UnmanagedType.LPWStr)] string id, int role);
  int SetEndpointVisibility();
}
public static class DefaultMic { public static int Set(string id) { var p = (IPolicyConfig)new PolicyConfigClient(); int r = 0; for (int role = 0; role < 3; role++) r |= p.SetDefaultEndpoint(id, role); return r; } }
'@
Add-Type -AssemblyName System.Runtime.InteropServices
$devs = Get-PnpDevice -Class AudioEndpoint -Status OK | Where-Object { $_.InstanceId -match '\{0\.0\.1\.00000000\}' }
$rows = foreach ($d in $devs) { $guid = ($d.InstanceId -split '\.')[-1]; [pscustomobject]@{ Name = $d.FriendlyName; Id = '{0.0.1.00000000}.' + $guid } }
if (-not $Name) {
  $rows | Format-Table -AutoSize | Out-String -Width 200
  $k = 'HKCU:\Software\Microsoft\Multimedia\Sound Mapper' ; "(current default: see Settings > System > Sound > Input)"
  return
}
$hit = $rows | Where-Object { $_.Name -like "*$Name*" } | Select-Object -First 1
if (-not $hit) { throw "no active capture device matching '$Name'" }
$r = [DefaultMic]::Set($hit.Id); "set default recording device -> $($hit.Name)  (hr=$r)"
